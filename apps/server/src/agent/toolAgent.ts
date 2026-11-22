import { randomUUID } from "node:crypto";
import { asMessageId, asToolCallId, type AgentEvent, type ApiErrorCode, type ModelProvider } from "@airport/shared";
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
import { ALL_TOOLS, toolsByName } from "./tools/registry.ts";
import { toWireResult } from "./tools/tool.ts";
import { parseToolCall } from "./toolCall.ts";

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

/** Max tool round-trips before the agent is forced to answer, so a loop can't run forever. */
const MAX_TOOL_STEPS = 10;

/**
 * The main agent: classify (shown as classify_message), then run a tool-use loop. Because the
 * LlmClient has no native function calling, tools are invoked via a JSON convention in the model's
 * text (see prompt.ts). Each tool the model picks is shown in the UI as a tool_call/tool_result
 * (the same events the classifier uses). Prior tool results are remembered per conversation and
 * injected back as focused context, so follow-ups reuse data instead of re-fetching.
 */
export class ToolAgent implements Agent {
  private readonly memory = new ConversationMemory();

  constructor(
    private readonly clients: Readonly<Record<ModelProvider, LlmClient>>,
    private readonly claudeMainModel?: string,
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
    const assembled = assembleRequest({ systemPrompt: buildSystemPrompt(ALL_TOOLS), history: messages, focusedRecords });
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

    try {
      for (let step = 0; step < MAX_TOOL_STEPS; step++) {
        let buffer = "";
        let mode: "undecided" | "tool" | "answer" = "undecided";

        for await (const ev of client.stream({ system: assembled.system, messages: convo, model, signal: input.signal })) {
          yield* startEvents();
          if (ev.type === "thinking_delta") {
            thinkingSince ??= Date.now();
            yield { type: "thinking_delta", messageId, delta: ev.text };
            continue;
          }
          if (ev.type !== "text_delta") break; // done
          buffer += ev.text;
          if (mode === "undecided") {
            const trimmed = buffer.trimStart();
            if (trimmed.length === 0) continue; // wait for the first real character
            // A tool call is pure JSON (starts with "{"); anything else is the final prose answer.
            mode = trimmed.startsWith("{") ? "tool" : "answer";
            if (mode === "answer") {
              yield* endThinking();
              yield { type: "text_delta", messageId, delta: buffer }; // flush the buffered prefix
            }
          } else if (mode === "answer") {
            yield { type: "text_delta", messageId, delta: ev.text };
          }
          // mode === "tool": accumulate silently until we can parse it.
        }

        if (mode !== "tool") {
          yield* endThinking();
          yield { type: "message_end", messageId, stopReason: "end_turn" };
          this.memory.commitFocus(convId, focus.codes);
          return;
        }

        const call = parseToolCall(buffer, (n) => toolsByName.has(n));
        if (call === null) {
          // Looked like JSON but wasn't a valid tool call: show it as the answer.
          yield* endThinking();
          yield { type: "text_delta", messageId, delta: buffer };
          yield { type: "message_end", messageId, stopReason: "end_turn" };
          return;
        }

        yield* endThinking();
        const toolCallId = asToolCallId(randomUUID());
        yield { type: "tool_call", messageId, toolCallId, name: call.name, input: call.input };
        const result = await toolsByName.get(call.name)!.run(call.input, { signal: input.signal });
        const wire = toWireResult(result);
        yield { type: "tool_result", messageId, toolCallId, result: wire };
        if (wire.ok) this.memory.record(convId, call.name, wire.output);

        convo.push({ role: "assistant", content: buffer });
        convo.push({ role: "user", content: `Tool ${call.name} returned: ${JSON.stringify(wire)}` });
      }

      // Tool budget exhausted: force one final answer so we never return an empty message.
      convo.push({
        role: "user",
        content: "You have reached the tool-call limit. Do NOT call any more tools. Give your final answer now using the information already gathered.",
      });
      let answered = false;
      for await (const ev of client.stream({ system: assembled.system, messages: convo, model, signal: input.signal })) {
        yield* startEvents();
        if (ev.type === "thinking_delta") {
          thinkingSince ??= Date.now();
          yield { type: "thinking_delta", messageId, delta: ev.text };
          continue;
        }
        if (ev.type !== "text_delta") break;
        if (!answered) {
          yield* endThinking();
          answered = true;
        }
        yield { type: "text_delta", messageId, delta: ev.text };
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
