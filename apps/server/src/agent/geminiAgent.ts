import { randomUUID } from "node:crypto";
import { asMessageId, type AgentEvent, type ChatTurn, type MessageId, type StopReason } from "@airport/shared";
import type { Agent, AgentRunInput } from "./agent.ts";
import { GeminiApiError, geminiErrorFromResponse, geminiNetworkError } from "./geminiErrors.ts";
import { readGeminiSse, type GeminiChunk } from "./geminiSse.ts";

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface GeminiAgentOptions {
  /** From GEMINI_API_KEY, trimmed. Never log it. */
  readonly apiKey: string;
  /** Injected in tests so no real API call is made. */
  readonly fetch?: FetchLike;
  readonly baseUrl?: string;
}

interface GeminiContent {
  readonly role: "user" | "model";
  readonly parts: { text: string }[];
}

/** The chat history as Gemini `contents`: empty turns dropped, same-role neighbours merged. */
export function toGeminiContents(messages: readonly ChatTurn[]): GeminiContent[] {
  const contents: GeminiContent[] = [];
  for (const turn of messages) {
    if (!turn.content.trim()) continue;
    const role = turn.role === "assistant" ? "model" : "user";
    const last = contents.at(-1);
    if (last?.role === role) last.parts.push({ text: turn.content });
    else contents.push({ role, parts: [{ text: turn.content }] });
  }
  return contents;
}

export function buildGeminiRequestBody(messages: readonly ChatTurn[], thinking: boolean): Record<string, unknown> {
  return {
    contents: toGeminiContents(messages),
    ...(thinking ? { generationConfig: { thinkingConfig: { includeThoughts: true } } } : {}),
  };
}

const STOP_REASONS: Readonly<Record<string, StopReason>> = { STOP: "end_turn", MAX_TOKENS: "max_tokens" };

function streamError(message: string): AgentEvent {
  return { type: "error", error: { code: "internal", message } };
}

/**
 * Calls the Gemini API with streaming and maps the reply to AgentEvents:
 * message_start -> (thinking_delta* thinking_end)? -> text_delta* -> message_end.
 *
 * Errors before the stream (bad key, quota, network) are thrown as GeminiApiError before
 * any event is yielded, so the route can answer with a normal HTTP error. Errors after
 * that become an `error` event. The request's AbortSignal cancels the HTTP request.
 */
export class GeminiAgent implements Agent {
  private readonly fetchFn: FetchLike;

  constructor(private readonly options: GeminiAgentOptions) {
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async *run({ request, model, signal }: AgentRunInput): AsyncGenerator<AgentEvent> {
    // The catalog's model id is the Gemini model name (e.g. "gemini-2.5-flash").
    // The key goes in the x-goog-api-key header, never in the URL.
    const url = `${this.options.baseUrl ?? GEMINI_API_BASE}/models/${encodeURIComponent(model.id)}:streamGenerateContent?alt=sse`;
    const body = buildGeminiRequestBody(request.messages, model.capabilities.thinking);
    const stream = await this.send(url, body, signal);

    const messageId = asMessageId(randomUUID());
    yield { type: "message_start", messageId, modelId: model.id };
    yield* this.mapStream(stream, messageId, signal);
  }

  /** Everything here happens before the first event, so failures are thrown, not streamed. */
  private async send(url: string, body: Record<string, unknown>, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.options.apiKey },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      throw geminiNetworkError();
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw geminiErrorFromResponse(response.status, text);
    }
    if (!response.body) throw new GeminiApiError("upstream", "Gemini sent an empty response.", response.status);
    return response.body;
  }

  private async *mapStream(
    body: ReadableStream<Uint8Array>,
    messageId: MessageId,
    signal: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    let thinkingSince: number | undefined;
    let stopReason: StopReason = "end_turn";
    const endThinking = (): AgentEvent | undefined => {
      if (thinkingSince === undefined) return undefined;
      const event: AgentEvent = { type: "thinking_end", messageId, durationMs: Date.now() - thinkingSince };
      thinkingSince = undefined;
      return event;
    };

    try {
      for await (const chunk of readGeminiSse(body)) {
        const problem = chunkProblem(chunk);
        if (problem) {
          const end = endThinking();
          if (end) yield end;
          yield streamError(problem);
          return;
        }
        const candidate = chunk.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (!part.text) continue;
          if (part.thought) {
            thinkingSince ??= Date.now();
            yield { type: "thinking_delta", messageId, delta: part.text };
          } else {
            const end = endThinking();
            if (end) yield end;
            yield { type: "text_delta", messageId, delta: part.text };
          }
        }
        if (candidate?.finishReason) stopReason = (Object.hasOwn(STOP_REASONS, candidate.finishReason) ? STOP_REASONS[candidate.finishReason] : undefined) ?? stopReason;
      }
    } catch (err) {
      if (signal.aborted) throw err;
      yield streamError("The connection to Gemini broke off mid-answer.");
      return;
    }

    const end = endThinking();
    if (end) yield end;
    yield { type: "message_end", messageId, stopReason };
  }
}

/** A plain-English reason when a chunk ends the answer badly (blocked, error), else undefined. */
function chunkProblem(chunk: GeminiChunk): string | undefined {
  if (chunk.error) {
    return chunk.error.code === 429
      ? "Gemini free-tier quota reached (rate limit). Wait a minute and try again."
      : `Gemini failed mid-answer (${chunk.error.status ?? chunk.error.code ?? "unknown error"}).`;
  }
  if (chunk.promptFeedback?.blockReason) {
    return `Gemini blocked this question (${chunk.promptFeedback.blockReason}).`;
  }
  const reason = chunk.candidates?.[0]?.finishReason;
  if (reason && !Object.hasOwn(STOP_REASONS, reason)) {
    return `Gemini stopped the answer early (${reason}).`;
  }
  return undefined;
}
