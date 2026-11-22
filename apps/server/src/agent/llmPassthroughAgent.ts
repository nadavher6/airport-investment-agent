import { randomUUID } from "node:crypto";
import { asMessageId, type AgentEvent, type ApiErrorCode, type ConversationId, type JsonValue, type MessageId, type ModelProvider } from "@airport/shared";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient } from "../llm/llmClient.ts";
import { mainModel } from "../llm/models.ts";
import type { Agent, AgentRunInput } from "./agent.ts";
import { classifyMessage, type Classification, type ClassificationLabel } from "./classifier/classifier.ts";
import { classificationToolEvents } from "./classifier/toolEvents.ts";
import { airportRecordsFrom, ConversationMemory } from "./conversationMemory.ts";
import { answerSystemContext } from "./flow/answerContext.ts";
import { candidateToolEvents, pickCandidates, routeOf, type Candidates } from "./flow/candidates.ts";
import { registryLookupTools, resolveCandidates, type LookupTools } from "./flow/resolve.ts";
import { defaultScoreAirportsTool, type ScoreAirportsTool } from "./flow/scoreAirports.ts";
import { defaultLoopTools, MAX_TOOL_STEPS, runToolLoop, type ToolLoopOutcome } from "./flow/toolLoop.ts";
import { runToolStep } from "./flow/toolStep.ts";
import { assembleRequest, buildMemorySystemBlock, selectFocusedRecords } from "./memory/assemble.ts";
import { resolveFocus } from "./memory/focus.ts";
import type { MemoryState } from "./memory/types.ts";
import { gradingSystemPrompt } from "./prompts/grading.ts";
import { buildToolLoopPrompt } from "./prompts/toolLoop.ts";
import type { RegisteredTool } from "./tools/tool.ts";
import { CAPABILITIES_ANSWER } from "./responses/capabilities.ts";
import { GREETING_ANSWER } from "./responses/greeting.ts";
import { offTopicAnswer, type Rng } from "./responses/offTopic.ts";

/**
 * Labels answered with one fixed text and no main LLM call (#21; greeting #44). off_topic picks its suggested
 * question with the agent's rng (#44). in_scope goes to the LLM.
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
  /** score_airports (#42). Default: the real tool from the TOOLS registry (PR #38). Tests pass a fake. */
  readonly scoreAirports?: ScoreAirportsTool;
  /** The lookup tools that resolve the candidates (#42). Default: the registry's. */
  readonly lookups?: LookupTools;
  /** The tool loop's tools (#48). Default: the lookups and get_enplanements from the registry (no score_airports). */
  readonly loopTools?: readonly RegisteredTool[];
  /** The per-conversation memory (#25/#48). Default: a bounded in-process store. */
  readonly memory?: ConversationMemory;
}

/** The memory a turn without a conversationId sees: nothing. */
const NO_MEMORY: MemoryState = { workingSet: new Map(), focusStack: [], lastPresentedList: [] };

/** Most candidate codes passed on when the loop asks for scores (the candidate schema's own bound). */
const MAX_CANDIDATE_CODES = 25;

/**
 * The agent: classifies the user's message (shown as a classify_message tool_call/tool_result), then:
 * - `greeting` / `capabilities` / `off_topic`: one fixed answer, no main LLM call (#21, #44);
 * - `in_scope`: the candidate step (fast model, strict JSON) decides the path by its `intent` (#48):
 *   - "score": the lookups that resolve the candidates, score_airports on at most 5 codes, each shown as a
 *     tool_call/tool_result pair; then the main model explains, with the results in its system context (#42),
 *     plus the compare skill for 2–5 scored airports (#46);
 *   - "lookup" (also when unsure): the tool loop (`flow/toolLoop.ts`) over the lookups and get_enplanements, at
 *     most 6 tool runs. score_airports is not a loop tool: a loop that asks for it goes to the scoring flow;
 * - `grading`: one main call with the grading skill in its system context, no tools (#43).
 * Memory (#25): with a `conversationId`, both paths cache their tool results and inject the focused ones into the
 * next turns' system context; with none, the turn has no memory.
 * The steps are held until the main LLM's first event, so an LlmError before it is still an HttpError (normal
 * 4xx/5xx); after it, an `error` event.
 */
export class LlmPassthroughAgent implements Agent {
  private readonly rng: Rng;
  private readonly scoreAirports: ScoreAirportsTool;
  private readonly lookups: LookupTools;
  private readonly loopTools: readonly RegisteredTool[];
  private readonly memory: ConversationMemory;

  constructor(
    private readonly clients: Readonly<Record<ModelProvider, LlmClient>>,
    /** CLAUDE_MODEL: replaces the Claude main model only. */
    private readonly claudeMainModel?: string,
    options: AgentOptions = {},
  ) {
    this.rng = options.rng ?? Math.random;
    this.scoreAirports = options.scoreAirports ?? defaultScoreAirportsTool();
    this.lookups = options.lookups ?? registryLookupTools();
    this.loopTools = options.loopTools ?? defaultLoopTools();
    this.memory = options.memory ?? new ConversationMemory();
  }

  /**
   * The scoring flow's tool steps (#42): resolve the candidates, score at most 5. Returns the events to show, the
   * answer's system context and the scored codes. Successful lookups and scores go to `remember` (#48).
   * An abort rethrows; a failed tool is a tool_result with ok: false.
   */
  private async scoreSteps(
    candidates: Candidates,
    messageId: MessageId,
    signal: AbortSignal,
    remember: (name: string, output: JsonValue) => void,
  ): Promise<{ events: AgentEvent[]; system: string; codes: readonly string[] }> {
    const resolution = await resolveCandidates(candidates, this.lookups, messageId, signal);
    const events: AgentEvent[] = resolution.steps.flatMap((step) => step.events);
    for (const step of resolution.steps) if (step.result.ok) remember(step.events[0].name, step.result.output);
    if (resolution.codes.length === 0) return { events, system: answerSystemContext({ resolution }), codes: [] };
    const scored = await runToolStep(this.scoreAirports, { airport_codes: [...resolution.codes] }, messageId, signal);
    events.push(...scored.events);
    if (scored.result.ok) remember(this.scoreAirports.name, scored.result.output);
    return { events, system: answerSystemContext({ resolution, score: scored.result }), codes: resolution.codes };
  }

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const client = this.clients[input.model.provider];

    const messageId = asMessageId(randomUUID());
    const { messages } = input.request;
    // First agent step (#13): classify the latest user message. A bad label falls back to in_scope (#19); a
    // failed call is retried, and after the last try it throws an LlmError (#22): nothing has streamed yet, so it
    // becomes an HttpError and the main LLM is never called. `greeting`, `capabilities` and `off_topic` get a fixed
    // answer (no main LLM call); the other labels continue to the LLM.
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
    // Memory (#25/#48): only with a conversationId; never keyed by message content.
    const conversationId: ConversationId | undefined = input.request.conversationId;
    const memoryState = conversationId !== undefined ? this.memory.state(conversationId) : NO_MEMORY;
    const focus = resolveFocus(lastUserMessage, memoryState);
    const focusedRecords = selectFocusedRecords(memoryState.workingSet, focus.codes);
    const touched: string[] = [...focus.codes];
    let presented: readonly string[] | undefined;
    const remember = (name: string, output: JsonValue): void => {
      if (conversationId === undefined) return;
      this.memory.record(conversationId, name, output);
      touched.push(...airportRecordsFrom(name, output).map(([code]) => code));
    };

    // #42 / #43 / #48: the label (and for in_scope the candidate intent) decides the steps and the main call's system context.
    let system: string | undefined;
    const prelude: AgentEvent[] = [...classified];
    let started = false;
    // The steps are held until the first LLM event, so a failure to start is still an HttpError.
    const begin = function* (): Generator<AgentEvent> {
      if (started) return;
      started = true;
      yield { type: "message_start", messageId, modelId: input.model.id };
      yield* prelude.splice(0);
    };
    const model = mainModel(client.provider, this.claudeMainModel);
    try {
      if (classification.label === "grading") system = gradingSystemPrompt();
      if (classification.label === "in_scope") {
        const picked = await pickCandidates(client, messages, input.signal);
        prelude.push(...candidateToolEvents(messageId, lastUserMessage, picked));
        let candidates = picked.candidates;
        if (routeOf(picked) === "lookup") {
          const assembled = assembleRequest({ systemPrompt: buildToolLoopPrompt(this.loopTools, MAX_TOOL_STEPS), history: messages, focusedRecords });
          const loop = runToolLoop({
            client,
            model,
            system: assembled.system,
            messages: assembled.messages,
            messageId,
            signal: input.signal,
            tools: this.loopTools,
            onToolResult: remember,
          });
          const outcome: ToolLoopOutcome = yield* relay(loop, begin);
          if (outcome.kind === "answered") {
            yield* begin();
            yield { type: "message_end", messageId, stopReason: outcome.stopReason };
            return;
          }
          // The loop asked for scores: the #42 flow scores them, capped at 5 like any scoring turn.
          candidates = { ...candidates, codes: [...new Set([...candidates.codes, ...outcome.codes])].slice(0, MAX_CANDIDATE_CODES) };
        }
        const steps = await this.scoreSteps(candidates, messageId, input.signal, remember);
        if (started) yield* steps.events;
        else prelude.push(...steps.events);
        presented = steps.codes;
        system = buildMemorySystemBlock(steps.system, { focusedRecords });
      }
      let thinkingSince: number | undefined;
      const endThinking = (): AgentEvent[] => {
        if (thinkingSince === undefined) return [];
        const durationMs = Date.now() - thinkingSince;
        thinkingSince = undefined;
        return [{ type: "thinking_end", messageId, durationMs }];
      };
      for await (const event of client.stream({ messages, signal: input.signal, model, ...(system !== undefined ? { system } : {}) })) {
        yield* begin();
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
    } finally {
      // Commit the turn's focus on every path (answer, error, abort), so the turn counter never drifts.
      if (conversationId !== undefined) this.memory.commitFocus(conversationId, [...new Set(touched)], presented);
    }
  }
}

/** Relays the loop's events (emitting message_start and the held steps before the first one) and returns its outcome. */
async function* relay(
  loop: AsyncGenerator<AgentEvent, ToolLoopOutcome>,
  begin: () => Generator<AgentEvent>,
): AsyncGenerator<AgentEvent, ToolLoopOutcome> {
  try {
    for (;;) {
      const step = await loop.next();
      if (step.done === true) return step.value;
      yield* begin();
      yield step.value;
    }
  } finally {
    await loop.return({ kind: "answered", stopReason: "cancelled" });
  }
}
