import { randomUUID } from "node:crypto";
import {
  asMessageId,
  asToolCallId,
  type AgentEvent,
  type ApiErrorCode,
  type ModelProvider,
  type ToolResult,
} from "@airport/shared";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient, type LlmMessage } from "../llm/llmClient.ts";
import { mainModel } from "../llm/models.ts";
import type { Agent, AgentRunInput } from "./agent.ts";
import { classifyMessage, type Classification, type ClassificationLabel } from "./classifier/classifier.ts";
import { classificationToolEvents } from "./classifier/toolEvents.ts";
import { ConversationMemory, conversationId } from "./conversationMemory.ts";
import { assembleRequest } from "./memory/assemble.ts";
import { selectFocusedRecords } from "./memory/assemble.ts";
import { resolveFocus } from "./memory/focus.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { CAPABILITIES_ANSWER } from "./responses/capabilities.ts";
import { OFF_TOPIC_ANSWER } from "./responses/offTopic.ts";
import { TOOLS } from "./tools/registry.ts";
import type { RegisteredTool } from "./tools/tool.ts";
import { looksLikeToolCall, parseModelStep } from "./toolCall.ts";
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
} from "./toolGuard.ts";

const STATIC_ANSWERS: Readonly<Partial<Record<ClassificationLabel, string>>> = {
  capabilities: CAPABILITIES_ANSWER,
  off_topic: OFF_TOPIC_ANSWER,
};

const API_CODE: Record<LlmError["code"], ApiErrorCode> = {
  unavailable: "model_unavailable",
  auth: "model_unavailable",
  rate_limit: "model_unavailable",
  bad_request: "bad_request",
  internal: "internal",
};

/** The tools the loop may call: the registry minus `score_airports` (#48, #49). */
export const LOOP_TOOLS: readonly RegisteredTool[] = TOOLS.filter((t) => t.name !== "score_airports");

/**
 * The main agent: classify (shown as classify_message), then run a tool-use loop. Because the
 * LlmClient has no native function calling, tools are invoked via a JSON convention in the model's
 * text (see prompt.ts). Each tool the model picks is shown in the UI as a tool_call/tool_result
 * (the same events the classifier uses). Prior tool results are remembered per conversation and
 * injected back as focused context, so follow-ups reuse data instead of re-fetching.
 *
 * Guardrails (#49): a broken, unknown, invalid, failing or repeated call is never thrown. It shows
 * as a failed tool card, and the model gets a TOOL_CALL_ERROR block (toolGuard.ts) and may retry,
 * at most MAX_INVALID_RETRIES times in a row and within MAX_TOOL_STEPS. Then tools are switched
 * off and the model answers in plain English.
 */
export class ToolAgent implements Agent {
  private readonly memory = new ConversationMemory();

  constructor(
    private readonly clients: Readonly<Record<ModelProvider, LlmClient>>,
    private readonly claudeMainModel?: string,
    /** The tools the loop may call; tests pass fakes. */
    private readonly tools: readonly RegisteredTool[] = LOOP_TOOLS,
  ) {}

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const client = this.clients[input.model.provider];
    const messageId = asMessageId(randomUUID());
    const { messages } = input.request;

    // Step 1: classify (#13). A pre-stream LlmError becomes an HttpError.
    let classification: Classification;
    try {
      classification = await classifyMessage(client, messages, input.signal);
    } catch (err) {
      if (err instanceof LlmError) throw new HttpError(API_CODE[err.code], err.message);
      throw err;
    }
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const classified = classificationToolEvents(messageId, lastUser, classification);

    // capabilities / off_topic: one fixed answer, no LLM, no tools.
    const staticAnswer = STATIC_ANSWERS[classification.label];
    if (staticAnswer !== undefined) {
      yield { type: "message_start", messageId, modelId: input.model.id };
      yield* classified;
      yield { type: "text_delta", messageId, delta: staticAnswer };
      yield { type: "message_end", messageId, stopReason: "end_turn" };
      return;
    }

    // Memory: resolve which cached airports this turn is about and inject them as focused context.
    const convId = conversationId(messages);
    const focus = resolveFocus(lastUser, this.memory.state(convId));
    const focusedRecords = selectFocusedRecords(this.memory.state(convId).workingSet, focus.codes);
    const assembled = assembleRequest({ systemPrompt: buildSystemPrompt(this.tools), history: messages, focusedRecords });
    const convo: LlmMessage[] = [...assembled.messages];
    const model = mainModel(client.provider, this.claudeMainModel);

    let started = false;
    let thinkingSince: number | undefined;
    const startEvents = (): AgentEvent[] => (started ? [] : ((started = true), [{ type: "message_start", messageId, modelId: input.model.id }, ...classified]));
    const endThinking = (): AgentEvent[] => {
      if (thinkingSince === undefined) return [];
      const ms = Date.now() - thinkingSince;
      thinkingSince = undefined;
      return [{ type: "thinking_end", messageId, durationMs: ms }];
    };

    const text = (delta: string): AgentEvent[] => (delta === "" ? [] : [...endThinking(), { type: "text_delta", messageId, delta }]);

    /**
     * Stream one model step. Prose is streamed live until a `{` or a backtick appears; from there
     * on the text is held back, so a tool call (fenced, after a lead-in, or broken) never reaches
     * the user. The caller flushes the held part when the step turns out to be prose.
     */
    async function* streamStep(): AsyncGenerator<AgentEvent, { readonly text: string; readonly shown: number }> {
      let buffer = "";
      let shown = 0;
      let holding = false;
      for await (const ev of client.stream({ system: assembled.system, messages: convo, model, signal: input.signal })) {
        yield* startEvents();
        if (ev.type === "thinking_delta") {
          thinkingSince ??= Date.now();
          yield { type: "thinking_delta", messageId, delta: ev.text };
          continue;
        }
        if (ev.type !== "text_delta") break; // done
        buffer += ev.text;
        if (holding) continue;
        const rest = buffer.slice(shown);
        const hold = rest.search(/[{`]/);
        const safe = hold === -1 ? rest : rest.slice(0, hold);
        yield* text(safe);
        shown += safe.length;
        holding = hold !== -1;
      }
      return { text: buffer, shown };
    }

    // Guardrail state for this turn (#49): calls already run, and the invalid-attempt streak.
    const seen = new Set<string>();
    let invalidStreak = 0;

    try {
      for (let step = 0; step < MAX_TOOL_STEPS; step++) {
        if (input.signal.aborted) return;
        const { text: reply, shown } = yield* streamStep();
        if (input.signal.aborted) return;

        const parsed = parseModelStep(reply);
        if (parsed.kind === "answer") {
          // An empty reply still ends with a readable answer.
          yield* text(reply.trim() === "" ? GRACEFUL_FALLBACK : reply.slice(shown));
          yield* endThinking();
          yield { type: "message_end", messageId, stopReason: "end_turn" };
          this.memory.commitFocus(convId, focus.codes);
          return;
        }

        yield* endThinking();
        const toolCallId = asToolCallId(randomUUID());
        const cardName = parsed.kind === "call" ? parsed.call.name : errorToolName(parsed.error);
        const cardInput = parsed.kind === "call" ? parsed.call.input : {};
        yield { type: "tool_call", messageId, toolCallId, name: cardName, input: cardInput };
        const outcome: GuardedResult =
          parsed.kind === "call"
            ? await runGuarded(parsed.call, this.tools, seen, { signal: input.signal })
            : { ok: false, error: parsed.error };
        if (input.signal.aborted) return;

        convo.push({ role: "assistant", content: reply });
        let observation: string;
        if (outcome.ok) {
          const wire: ToolResult = { ok: true, output: outcome.output };
          yield { type: "tool_result", messageId, toolCallId, result: wire };
          this.memory.record(convId, outcome.tool.name, outcome.output);
          observation = `Tool ${outcome.tool.name} returned: ${JSON.stringify(wire)}`;
          invalidStreak = nextInvalidStreak(invalidStreak, null);
        } else {
          yield { type: "tool_result", messageId, toolCallId, result: { ok: false, errorMessage: errorUiMessage(outcome.error) } };
          observation = renderFeedback(outcome.error, this.tools);
          invalidStreak = nextInvalidStreak(invalidStreak, outcome.error);
        }

        if (retriesExhausted(invalidStreak) || step === MAX_TOOL_STEPS - 1) {
          const toolsOff: ToolsOffReason = retriesExhausted(invalidStreak) ? "retries_exhausted" : "step_cap";
          convo.push({ role: "user", content: `${observation}\n\n${renderToolsOff(toolsOff)}` });
          break;
        }
        convo.push({ role: "user", content: observation });
      }

      // Tools are off (retry budget or step cap): one last call for a plain-English answer.
      if (input.signal.aborted) return;
      const { text: reply, shown } = yield* streamStep();
      if (input.signal.aborted) return;
      const rest = reply.slice(shown);
      if (looksLikeToolCall(rest) || reply.trim() === "") {
        yield* text(shown > 0 ? `\n\n${GRACEFUL_FALLBACK}` : GRACEFUL_FALLBACK);
      } else {
        yield* text(rest);
      }
      yield* endThinking();
      yield { type: "message_end", messageId, stopReason: "end_turn" };
      this.memory.commitFocus(convId, focus.codes);
    } catch (err) {
      if (!(err instanceof LlmError)) throw err;
      if (!started) throw new HttpError(API_CODE[err.code], err.message);
      yield { type: "error", error: { code: API_CODE[err.code], message: err.message } };
    }
  }
}
