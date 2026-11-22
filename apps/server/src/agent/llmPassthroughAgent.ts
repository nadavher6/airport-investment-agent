import { randomUUID } from "node:crypto";
import { asMessageId, type AgentEvent, type ApiErrorCode, type ModelProvider } from "@airport/shared";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient } from "../llm/llmClient.ts";
import { mainModel } from "../llm/models.ts";
import type { Agent, AgentRunInput } from "./agent.ts";
import { classifyMessage, type Classification, type ClassificationLabel } from "./classifier/classifier.ts";
import { classificationToolEvents } from "./classifier/toolEvents.ts";
import { SCORE_AIRPORTS_TOOL_NAME, type ScoreAirportsTool } from "./flow/scoreAirports.ts";
import { MAX_TOOL_STEPS, runToolLoop } from "./flow/toolLoop.ts";
import { buildToolLoopPrompt } from "./prompts/toolLoop.ts";
import { CAPABILITIES_ANSWER } from "./responses/capabilities.ts";
import { GREETING_ANSWER } from "./responses/greeting.ts";
import { offTopicAnswer, type Rng } from "./responses/offTopic.ts";
import { TOOLS } from "./tools/registry.ts";
import type { RegisteredTool } from "./tools/tool.ts";

/**
 * Labels answered with one fixed text and no main LLM call (#21; greeting #44). off_topic picks its suggested
 * question with the agent's rng (#44). The other labels go to the tool loop.
 */
const STATIC_ANSWERS: Readonly<Partial<Record<ClassificationLabel, (rng: Rng) => string>>> = {
  greeting: () => GREETING_ANSWER,
  capabilities: () => CAPABILITIES_ANSWER,
  off_topic: (rng) => offTopicAnswer(rng),
};

const API_CODE: Record<LlmError["code"], ApiErrorCode> = {
  unavailable: "model_unavailable",
  auth: "model_unavailable",
  rate_limit: "model_unavailable",
  bad_request: "bad_request",
  internal: "internal",
};

/** Optional agent dependencies, injectable for tests. */
export interface AgentOptions {
  /** The random source for the off_topic suggestion (#44). Default Math.random. */
  readonly rng?: Rng;
  /** Replaces the registry's score_airports in the loop's tools. Tests pass a fake. */
  readonly scoreAirports?: ScoreAirportsTool;
}

/**
 * The agent (#48): classifies the user's message (shown as a classify_message tool_call/tool_result), then:
 * - `greeting` / `capabilities` / `off_topic`: one fixed answer, no main LLM call (#21, #44);
 * - every other label (`in_scope`, `grading`): the ReAct tool loop (`flow/toolLoop.ts`) with ALL registry tools,
 *   score_airports included (at most 5 codes, enforced in the loop). The loop's system prompt carries the compare
 *   skill always, and the grading skill for `grading`.
 * The classify step is held until the main LLM's first event, so an LlmError before it is still an HttpError
 * (normal 4xx/5xx); after it, an `error` event.
 */
export class LlmPassthroughAgent implements Agent {
  private readonly rng: Rng;
  private readonly tools: readonly RegisteredTool[];

  constructor(
    private readonly clients: Readonly<Record<ModelProvider, LlmClient>>,
    /** CLAUDE_MODEL: replaces the Claude main model only. */
    private readonly claudeMainModel?: string,
    options: AgentOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
    const score = options.scoreAirports;
    this.tools = score === undefined ? TOOLS : TOOLS.map((tool) => (tool.name === SCORE_AIRPORTS_TOOL_NAME ? score : tool));
  }

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const client = this.clients[input.model.provider];

    const messageId = asMessageId(randomUUID());
    const { messages } = input.request;
    // First agent step (#13): classify the latest user message. A bad label falls back to in_scope (#19); a
    // failed call is retried, and after the last try it throws an LlmError (#22): nothing has streamed yet, so it
    // becomes an HttpError and the main LLM is never called.
    let classification: Classification;
    try {
      classification = await classifyMessage(client, messages, input.signal);
    } catch (err) {
      if (err instanceof LlmError) throw new HttpError(API_CODE[err.code], err.message);
      throw err;
    }
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const classified = classificationToolEvents(messageId, lastUserMessage, classification);
    // #21/#44: greeting, capabilities and off_topic (which covers prompt injection) get one fixed answer; the main LLM is not called.
    const staticAnswer = STATIC_ANSWERS[classification.label];
    if (staticAnswer !== undefined) {
      yield { type: "message_start", messageId, modelId: input.model.id };
      yield* classified;
      yield { type: "text_delta", messageId, delta: staticAnswer(this.rng) };
      yield { type: "message_end", messageId, stopReason: "end_turn" };
      return;
    }

    let started = false;
    const loop = runToolLoop({
      client,
      model: mainModel(client.provider, this.claudeMainModel),
      system: buildToolLoopPrompt(this.tools, MAX_TOOL_STEPS, { grading: classification.label === "grading" }),
      messages,
      messageId,
      signal: input.signal,
      tools: this.tools,
    });
    try {
      for (;;) {
        const step = await loop.next();
        // The classify step is held until the loop's first event, so a failure to start is still an HttpError.
        if (!started) {
          started = true;
          yield { type: "message_start", messageId, modelId: input.model.id };
          yield* classified;
        }
        if (step.done === true) {
          yield { type: "message_end", messageId, stopReason: step.value };
          return;
        }
        yield step.value;
      }
    } catch (err) {
      if (!(err instanceof LlmError)) throw err;
      if (!started) throw new HttpError(API_CODE[err.code], err.message);
      yield { type: "error", error: { code: API_CODE[err.code], message: err.message } };
    } finally {
      await loop.return("cancelled");
    }
  }
}
