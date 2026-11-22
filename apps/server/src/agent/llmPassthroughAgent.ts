import { randomUUID } from "node:crypto";
import { asMessageId, type AgentEvent, type ApiErrorCode, type ModelProvider } from "@airport/shared";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient } from "../llm/llmClient.ts";
import { mainModel } from "../llm/models.ts";
import type { Agent, AgentRunInput } from "./agent.ts";
import { classifyMessage, type Classification, type ClassificationLabel } from "./classifier/classifier.ts";
import { classificationToolEvents } from "./classifier/toolEvents.ts";
import { CAPABILITIES_ANSWER } from "./responses/capabilities.ts";
import { OFF_TOPIC_ANSWER } from "./responses/offTopic.ts";

/** Labels answered with one fixed text and no main LLM call (#21). greeting and in_scope go to the LLM. */
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
    // First agent step (#13): classify the latest user message. A bad label falls back to in_scope (#19); a
    // failed call is retried, and after the last try it throws an LlmError (#22): nothing has streamed yet, so it
    // becomes an HttpError and the main LLM is never called. `capabilities` and `off_topic` get a fixed answer
    // (no main LLM call); the other labels continue to the LLM.
    let classification: Classification;
    try {
      classification = await classifyMessage(client, messages, input.signal);
    } catch (err) {
      if (err instanceof LlmError) throw new HttpError(API_CODE[err.code], err.message);
      throw err;
    }
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const classified = classificationToolEvents(messageId, lastUserMessage, classification);
    // #21: capabilities and off_topic (which covers prompt injection) get one fixed answer; the main LLM is not called.
    const staticAnswer = STATIC_ANSWERS[classification.label];
    if (staticAnswer !== undefined) {
      yield { type: "message_start", messageId, modelId: input.model.id };
      yield* classified;
      yield { type: "text_delta", messageId, delta: staticAnswer };
      yield { type: "message_end", messageId, stopReason: "end_turn" };
      return;
    }
    let started = false;
    let thinkingSince: number | undefined;
    const endThinking = (): AgentEvent[] => {
      if (thinkingSince === undefined) return [];
      const durationMs = Date.now() - thinkingSince;
      thinkingSince = undefined;
      return [{ type: "thinking_end", messageId, durationMs }];
    };
    try {
      const model = mainModel(client.provider, this.claudeMainModel);
      for await (const event of client.stream({ messages, signal: input.signal, model })) {
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
