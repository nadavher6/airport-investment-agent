import { randomUUID } from "node:crypto";
import { asToolCallId, type AgentEvent, type JsonValue, type MessageId, type StopReason } from "@airport/shared";
import type { LlmClient, LlmMessage } from "../../llm/llmClient.ts";
import { EMPTY_ANSWER, stepLimitAnswer } from "../prompts/toolLoop.ts";
import type { RegisteredTool } from "../tools/tool.ts";
import { parseModelStep, type ParsedToolCall } from "../toolCall.ts";
import {
  GRACEFUL_FALLBACK,
  MAX_TOOL_STEPS,
  errorToolName,
  errorUiMessage,
  nextInvalidStreak,
  renderFeedback,
  renderToolsOff,
  retriesExhausted,
  runGuarded,
  type GuardedResult,
  type ToolsOffReason,
} from "../toolGuard.ts";
import { MAX_SCORED_AIRPORTS, SCORE_AIRPORTS_TOOL_NAME } from "./scoreAirports.ts";

/** The policy constants live in toolGuard.ts (#49); re-exported for the agent and its prompt. */
export { MAX_INVALID_RETRIES, MAX_TOOL_STEPS } from "../toolGuard.ts";

/** The problem fed back (the tool does not run) when score_airports gets more than MAX_SCORED_AIRPORTS codes. */
export const TOO_MANY_AIRPORTS = `max ${MAX_SCORED_AIRPORTS} airports; pick the ${MAX_SCORED_AIRPORTS} most relevant`;

/** The loop's own input rule on top of the tool's zod schema: at most 5 distinct codes for score_airports. */
function loopRule(call: ParsedToolCall): string | null {
  if (call.name !== SCORE_AIRPORTS_TOOL_NAME) return null;
  const codes = call.input.airport_codes;
  if (!Array.isArray(codes)) return null; // the tool's schema reports it
  const distinct = new Set(codes.map((c) => (typeof c === "string" ? c.trim().toUpperCase() : JSON.stringify(c))));
  return distinct.size > MAX_SCORED_AIRPORTS ? `airport_codes — ${TOO_MANY_AIRPORTS}` : null;
}

export interface ToolLoopInput {
  readonly client: LlmClient;
  readonly model: string;
  readonly system: string;
  readonly messages: readonly LlmMessage[];
  readonly messageId: MessageId;
  readonly signal: AbortSignal;
  /** The only tools the model may run. Fixed by the server: nothing in the user's text can add one. */
  readonly tools: readonly RegisteredTool[];
  /** Called with every successful tool output (a hook for the memory follow-up; unused by the agent for now). */
  readonly onToolResult?: (name: string, output: JsonValue) => void;
}

/** A step's text is held from its first "{" or "`" on, so tool-call JSON is never streamed to the user. */
const HOLD_FROM = /[{`]/;

/**
 * The agent's ReAct loop (#48) over the text-only LlmClient, with the tool-call guardrails (#49).
 * Each step's reply is parsed as a whole (toolCall.ts). Prose before any "{" or "`" streams live; the rest
 * of a step is held until the step is parsed, so raw JSON never reaches the user.
 *
 * Every attempted call shows as a tool_call/tool_result pair. A call that is unparseable, has the wrong
 * shape, names an unknown tool, fails its input schema (or the 5-airport rule), fails in the tool, or
 * repeats an earlier call of this turn is a typed ToolCallError: a failed card for the user, and a
 * delimited TOOL_CALL_ERROR block (with the expected JSON Schema) for the model, never a throw.
 * The model may retry MAX_INVALID_RETRIES times in a row (a `not_found` is not retried); every attempt
 * counts toward MAX_TOOL_STEPS. Then tools are switched off and the model gets one call to answer in
 * prose; the answer is never empty and never raw JSON.
 * Yields no message_start/message_end (the agent does) and returns the stop reason. An abort rethrows at
 * once, also mid-retry; an LlmError propagates to the agent.
 */
export async function* runToolLoop(input: ToolLoopInput): AsyncGenerator<AgentEvent, StopReason> {
  const { client, model, system, messageId, signal, tools } = input;
  const convo: LlmMessage[] = [...input.messages];
  const seen = new Set<string>();
  let thinkingSince: number | undefined;
  let shown = "";
  let separate = false;
  let invalidStreak = 0;

  function* endThinking(): Generator<AgentEvent> {
    if (thinkingSince === undefined) return;
    const durationMs = Date.now() - thinkingSince;
    thinkingSince = undefined;
    yield { type: "thinking_end", messageId, durationMs };
  }
  function* show(text: string): Generator<AgentEvent> {
    if (text === "") return;
    yield* endThinking();
    const delta = separate && shown !== "" ? `\n\n${text}` : text;
    separate = false;
    shown += delta;
    yield { type: "text_delta", messageId, delta };
  }

  /** One model call: streams thinking and the live prose prefix, returns the whole text and the stop reason. */
  async function* step(): AsyncGenerator<AgentEvent, { text: string; held: string; live: string; stopReason: StopReason }> {
    signal.throwIfAborted();
    const before = shown.length;
    let text = "";
    let held = "";
    let live = true;
    let stopReason: StopReason = "end_turn";
    for await (const ev of client.stream({ system, messages: convo, model, signal })) {
      if (ev.type === "thinking_delta") {
        thinkingSince ??= Date.now();
        yield { type: "thinking_delta", messageId, delta: ev.text };
      } else if (ev.type === "text_delta") {
        text += ev.text;
        if (!live) {
          held += ev.text;
          continue;
        }
        const cut = ev.text.search(HOLD_FROM);
        if (cut === -1) {
          yield* show(ev.text);
        } else {
          yield* show(ev.text.slice(0, cut));
          held = ev.text.slice(cut);
          live = false;
        }
      } else {
        stopReason = ev.stopReason === "max_tokens" ? "max_tokens" : "end_turn";
        break;
      }
    }
    signal.throwIfAborted();
    return { text, held, live: shown.slice(before), stopReason };
  }

  /** Ends the turn; `fallback` (a plain sentence, set apart from any lead-in shown) when there is no answer text. */
  function* finish(stopReason: StopReason, fallback?: string): Generator<AgentEvent, StopReason> {
    yield* endThinking();
    if (fallback !== undefined) {
      separate = true;
      yield* show(fallback);
    }
    return stopReason;
  }

  let toolsOff: ToolsOffReason = "step_cap";
  for (let attempt = 0; attempt < MAX_TOOL_STEPS; attempt++) {
    const { text, held, live, stopReason } = yield* step();
    const parsed = parseModelStep(text);
    if (parsed.kind === "answer") {
      yield* show(held);
      return yield* finish(stopReason, `${live}${held}`.trim() === "" ? EMPTY_ANSWER : undefined);
    }

    // An attempted call, good or bad: one tool card, and one observation for the model.
    yield* endThinking();
    separate = true;
    const toolCallId = asToolCallId(randomUUID());
    const name = parsed.kind === "call" ? parsed.call.name : errorToolName(parsed.error);
    yield { type: "tool_call", messageId, toolCallId, name, input: parsed.kind === "call" ? parsed.call.input : {} };
    const outcome: GuardedResult =
      parsed.kind === "call"
        ? await runGuarded(parsed.call, tools, seen, { signal }, loopRule)
        : { ok: false, error: parsed.error };
    signal.throwIfAborted();

    if (outcome.ok) {
      const wire = { ok: true, output: outcome.output } as const;
      yield { type: "tool_result", messageId, toolCallId, result: wire };
      input.onToolResult?.(outcome.tool.name, outcome.output);
      const note = parsed.kind === "call" && parsed.extra ? "\nOnly the first tool call in your reply was run." : "";
      convo.push(
        { role: "assistant", content: JSON.stringify({ tool: outcome.tool.name, input: parsed.kind === "call" ? parsed.call.input : {} }) },
        { role: "user", content: `<tool_result name="${outcome.tool.name}">${JSON.stringify(wire)}</tool_result>${note}` },
      );
      invalidStreak = nextInvalidStreak(invalidStreak, null);
    } else {
      yield { type: "tool_result", messageId, toolCallId, result: { ok: false, errorMessage: errorUiMessage(outcome.error) } };
      convo.push({ role: "assistant", content: text }, { role: "user", content: renderFeedback(outcome.error, tools) });
      invalidStreak = nextInvalidStreak(invalidStreak, outcome.error);
      if (retriesExhausted(invalidStreak)) {
        toolsOff = "retries_exhausted";
        break;
      }
    }
  }

  // Tools are off (the retry budget or the step cap): one last call with no tools. A reply that still
  // calls a tool, or is empty, gets the plain answer instead.
  const last = convo.at(-1);
  if (last !== undefined && last.role === "user") convo[convo.length - 1] = { role: "user", content: `${last.content}\n\n${renderToolsOff(toolsOff)}` };
  else convo.push({ role: "user", content: renderToolsOff(toolsOff) });
  const final = yield* step();
  const answered = parseModelStep(final.text).kind === "answer" && `${final.live}${final.held}`.trim() !== "";
  if (answered) yield* show(final.held);
  const fallback = toolsOff === "retries_exhausted" ? GRACEFUL_FALLBACK : stepLimitAnswer(MAX_TOOL_STEPS);
  return yield* finish(final.stopReason, answered ? undefined : fallback);
}
