import { randomUUID } from "node:crypto";
import { asMessageId, type AgentEvent, type ApiErrorCode, type ModelProvider } from "@airport/shared";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient } from "../llm/llmClient.ts";
import { mainModel } from "../llm/models.ts";
import type { Agent, AgentRunInput } from "./agent.ts";
import { classifyMessage } from "./classifier/classifier.ts";
import { classificationToolEvents } from "./classifier/toolEvents.ts";

const API_CODE: Record<LlmError["code"], ApiErrorCode> = {
  unavailable: "model_unavailable",
  auth: "model_unavailable",
  rate_limit: "model_unavailable",
  bad_request: "bad_request",
  internal: "internal",
};

/**
 * Placeholder agent until the owner's agent replaces it: classifies the user's message (shown as a
 * classify_message tool_call/tool_result), then sends the conversation to the LlmClient for the
 * model's provider (every provider has one) and maps its stream to AgentEvents.
 * An LlmError before the first event becomes an HttpError (normal 4xx/5xx); after it, an `error` event.
 */
export class LlmPassthroughAgent implements Agent {
  constructor(
    private readonly clients: Readonly<Record<ModelProvider, LlmClient>>,
    /** CLAUDE_MODEL: replaces the Claude main model only. */
    private readonly claudeMainModel?: string,
  ) {}

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const client = this.clients[input.model.provider];

    const messageId = asMessageId(randomUUID());
    const { messages } = input.request;
    // First agent step (#13): classify the latest user message. It never throws an LlmError (it falls back
    // to in_scope), only an abort. No per-label behaviour yet: the message continues to the LLM as before.
    const classification = await classifyMessage(client, messages, input.signal);
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const classified = classificationToolEvents(messageId, lastUserMessage, classification);
    let started = false;
    let thinkingSince: number | undefined;
    const endThinking = (): AgentEvent[] => {
      if (thinkingSince === undefined) return [];
      const durationMs = Date.now() - thinkingSince;
      thinkingSince = undefined;
      return [{ type: "thinking_end", messageId, durationMs }];
    };
    try {
      for await (const event of client.stream({ messages, signal: input.signal, model: mainModel(client.provider, this.claudeMainModel) })) {
        // The classify step is held until the LLM's first event, so a failure to start is still an HttpError.
        if (!started) {
          yield { type: "message_start", messageId, modelId: input.model.id };
          yield* classified;
        }
        started = true;
        if (event.type === "thinking_delta") {
          thinkingSince ??= Date.now();
          yield { type: "thinking_delta", messageId, delta: event.text };
        } else if (event.type === "text_delta") {
          yield* endThinking();
          yield { type: "text_delta", messageId, delta: event.text };
        } else {
          yield* endThinking();
          yield { type: "message_end", messageId, stopReason: event.stopReason === "max_tokens" ? "max_tokens" : "end_turn" };
          return;
        }
      }
    } catch (err) {
      if (!(err instanceof LlmError)) throw err;
      if (!started) throw new HttpError(API_CODE[err.code], err.message);
      yield { type: "error", error: { code: API_CODE[err.code], message: err.message } };
    }
  }
}
