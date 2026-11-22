import { randomUUID } from "node:crypto";
import { asToolCallId, type AgentEvent, type JsonValue, type MessageId, type StopReason } from "@airport/shared";
import type { LlmClient, LlmMessage } from "../../llm/llmClient.ts";
import { ANSWER_NOW, BAD_CALL_ANSWER, badCallObservation, EMPTY_ANSWER, stepLimitAnswer } from "../prompts/toolLoop.ts";
import { getTool } from "../tools/registry.ts";
import { toWireResult, type RegisteredTool } from "../tools/tool.ts";
import { parseToolCall } from "../toolCall.ts";
import { SCORE_AIRPORTS_TOOL_NAME } from "./scoreAirports.ts";

/** Most tool runs in one lookup turn (#48). After it, the model gets one last call to answer with no tools. */
export const MAX_TOOL_STEPS = 6;

/** The loop's tools: the lookups and get_enplanements. score_airports is NOT one (it goes to the #42 flow). */
export const LOOP_TOOL_NAMES = ["get_airport_by_code", "find_airports_by_city", "find_airports_by_region", "get_enplanements"] as const;

/** The loop tools from the #30 registry (getTool). A missing one is a programming error. */
export function defaultLoopTools(): RegisteredTool[] {
  return LOOP_TOOL_NAMES.map((name) => {
    const tool = getTool(name);
    if (tool === undefined) throw new Error(`The ${name} tool is not in the registry`);
    return tool;
  });
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

/** How the loop ended: with an answer streamed, or with the model asking for scores (the agent runs #42's flow). */
export type ToolLoopOutcome =
  | { readonly kind: "answered"; readonly stopReason: StopReason }
  | { readonly kind: "score"; readonly codes: readonly string[] };

/** A step's text is held from its first "{" or "`" on, so tool-call JSON is never streamed to the user. */
const HOLD_FROM = /[{`]/;

/**
 * The lookup path's ReAct loop (#48) over the text-only LlmClient. Each step's reply is parsed as a whole
 * (toolCall.ts): a call is run through the registry tool's `run` (its zod schema validates the input first) and
 * shown as a tool_call/tool_result pair, and its result goes back to the model as delimited data. Prose before
 * any "{" or "`" streams live; the rest of a step is held until the step is parsed, so raw JSON never reaches
 * the user. A bad call (malformed JSON, unknown tool) is fed back ONCE; a second one ends with a plain answer.
 * After MAX_TOOL_STEPS tool runs the model gets one call to answer with no tools; the answer is never empty.
 * A score_airports call ends the loop with `{ kind: "score" }`. Yields no message_start/message_end (the agent
 * does). An abort rethrows at the next step; an LlmError propagates to the agent.
 */
export async function* runToolLoop(input: ToolLoopInput): AsyncGenerator<AgentEvent, ToolLoopOutcome> {
  const { client, model, system, messageId, signal } = input;
  const byName = new Map(input.tools.map((tool) => [tool.name, tool]));
  const toolNames = [...byName.keys(), SCORE_AIRPORTS_TOOL_NAME];
  const convo: LlmMessage[] = [...input.messages];
  let thinkingSince: number | undefined;
  let shown = "";
  let separate = false;
  let badCalls = 0;
  let toolRuns = 0;

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
  function* finish(stopReason: StopReason, fallback?: string): Generator<AgentEvent, ToolLoopOutcome> {
    yield* endThinking();
    if (fallback !== undefined) {
      separate = true;
      yield* show(fallback);
    }
    return { kind: "answered", stopReason };
  }

  while (toolRuns < MAX_TOOL_STEPS) {
    const { text, held, live, stopReason } = yield* step();
    const parsed = parseToolCall(text);
    if (parsed.kind === "answer") {
      yield* show(held);
      return yield* finish(stopReason, `${live}${held}`.trim() === "" ? EMPTY_ANSWER : undefined);
    }
    if (parsed.kind === "call" && parsed.name === SCORE_AIRPORTS_TOOL_NAME) {
      yield* endThinking();
      const raw = parsed.input.airport_codes;
      const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
      return { kind: "score", codes };
    }
    const tool = parsed.kind === "call" ? byName.get(parsed.name) : undefined;
    if (parsed.kind === "bad" || tool === undefined) {
      // Unknown tool or unreadable JSON: one error back to the model, once; never shown to the user.
      if (badCalls >= 1) return yield* finish(stopReason, BAD_CALL_ANSWER);
      badCalls += 1;
      separate = true;
      const reason = parsed.kind === "bad" ? parsed.reason : `there is no tool named ${JSON.stringify(parsed.name.slice(0, 60))}`;
      convo.push({ role: "assistant", content: text }, { role: "user", content: badCallObservation(reason, toolNames) });
      continue;
    }
    if (parsed.kind !== "call") continue; // unreachable: narrows `parsed` for the type checker
    yield* endThinking();
    separate = true;
    toolRuns += 1;
    const toolCallId = asToolCallId(randomUUID());
    yield { type: "tool_call", messageId, toolCallId, name: tool.name, input: parsed.input };
    // RegisteredTool.run validates the input with the tool's zod schema before the tool runs, and never throws.
    const wire = toWireResult(await tool.run(parsed.input, { signal }));
    signal.throwIfAborted();
    yield { type: "tool_result", messageId, toolCallId, result: wire };
    if (wire.ok) input.onToolResult?.(tool.name, wire.output);
    const note = parsed.extra ? "\nOnly the first tool call in your reply was run." : "";
    convo.push(
      { role: "assistant", content: JSON.stringify({ tool: tool.name, input: parsed.input }) },
      { role: "user", content: `<tool_result name="${tool.name}">${JSON.stringify(wire)}</tool_result>${note}` },
    );
  }

  // The cap: one last call with no tools. A reply that still calls a tool, or is empty, gets the plain answer.
  convo.push({ role: "user", content: ANSWER_NOW });
  const last = yield* step();
  const answered = parseToolCall(last.text).kind === "answer" && `${last.live}${last.held}`.trim() !== "";
  if (answered) yield* show(last.held);
  return yield* finish(last.stopReason, answered ? undefined : stepLimitAnswer(MAX_TOOL_STEPS));
}
