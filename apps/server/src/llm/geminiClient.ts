import { geminiErrorFromResponse, geminiNetworkError, GEMINI_QUOTA_MESSAGE } from "./geminiErrors.ts";
import { readGeminiSse, type GeminiChunk } from "./geminiSse.ts";
import { LlmError, type LlmClient, type LlmMessage, type LlmRequest, type LlmStreamEvent } from "./llmClient.ts";

export const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
/** The catalog's existing Gemini model. */
export const GEMINI_MODEL = "gemini-3.5-flash";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface GeminiClientOptions {
  /** GEMINI_API_KEY from .env. Trimmed here; never logged. Unset or blank = unavailable. */
  readonly apiKey: string | undefined;
  /** Injected in tests so no real API call is made. */
  readonly fetch?: FetchLike;
  readonly baseUrl?: string;
  /** Health check timeout; 5 s by default. */
  readonly healthTimeoutMs?: number;
}

interface GeminiContent {
  readonly role: "user" | "model";
  readonly parts: { text: string }[];
}

/** The history as Gemini `contents`: empty turns dropped, same-role neighbours merged. */
export function toGeminiContents(messages: readonly LlmMessage[]): GeminiContent[] {
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

function requestBody(request: LlmRequest): Record<string, unknown> {
  return {
    // Passed through only if given; nothing in this app sets it.
    ...(request.system ? { systemInstruction: { parts: [{ text: request.system }] } } : {}),
    contents: toGeminiContents(request.messages),
    generationConfig: { thinkingConfig: { includeThoughts: true } },
  };
}

const STOP_REASONS: Readonly<Record<string, string>> = { STOP: "end_turn", MAX_TOKENS: "max_tokens" };

function stopReasonOf(finishReason: string | undefined): string | undefined {
  return finishReason && Object.hasOwn(STOP_REASONS, finishReason) ? STOP_REASONS[finishReason] : undefined;
}

/** An LlmError when a chunk ends the answer badly (error, block), else undefined. */
function chunkError(chunk: GeminiChunk): LlmError | undefined {
  if (chunk.error) {
    return chunk.error.code === 429
      ? new LlmError("rate_limit", GEMINI_QUOTA_MESSAGE)
      : new LlmError("internal", `Gemini failed mid-answer (${chunk.error.status ?? chunk.error.code ?? "unknown error"}).`);
  }
  if (chunk.promptFeedback?.blockReason) {
    return new LlmError("bad_request", `Gemini blocked this question (${chunk.promptFeedback.blockReason}).`);
  }
  const reason = chunk.candidates?.[0]?.finishReason;
  if (reason && !stopReasonOf(reason)) {
    return new LlmError("bad_request", `Gemini stopped the answer early (${reason}).`);
  }
  return undefined;
}

/**
 * Google Gemini over its REST API (`streamGenerateContent?alt=sse`) with plain fetch.
 * The key goes in the x-goog-api-key header, never in the URL. The request's signal
 * cancels the HTTP call. Every failure is thrown as an LlmError.
 */
export class GeminiClient implements LlmClient {
  readonly provider = "gemini" as const;
  private readonly apiKey: string | undefined;
  private readonly fetchFn: FetchLike;
  private readonly baseUrl: string;
  private readonly healthTimeoutMs: number;

  constructor(options: GeminiClientOptions) {
    this.apiKey = options.apiKey?.trim() || undefined;
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.baseUrl = options.baseUrl ?? GEMINI_API_BASE;
    this.healthTimeoutMs = options.healthTimeoutMs ?? 5000;
  }

  /** A cheap, free check that the key works: list one model. Never hangs (timeout). */
  async health(): Promise<{ status: "ok" | "unavailable" | "error"; detail: string }> {
    if (!this.apiKey) return { status: "unavailable", detail: "GEMINI_API_KEY is not set in .env" };
    try {
      const response = await this.fetchFn(`${this.baseUrl}/models?pageSize=1`, {
        method: "GET",
        headers: { "x-goog-api-key": this.apiKey },
        signal: AbortSignal.timeout(this.healthTimeoutMs),
      });
      if (response.ok) {
        await response.body?.cancel();
        return { status: "ok", detail: "Gemini connected" };
      }
      const error = geminiErrorFromResponse(response.status, await response.text().catch(() => ""));
      return { status: "error", detail: error.code === "auth" ? "Gemini: invalid API key" : error.message };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      const detail = timedOut
        ? `Gemini did not answer within ${this.healthTimeoutMs / 1000} s`
        : "Could not reach the Gemini API";
      return { status: "error", detail };
    }
  }

  async *stream(request: LlmRequest): AsyncGenerator<LlmStreamEvent> {
    const body = await this.send(request);
    let stopReason = "end_turn";
    try {
      for await (const chunk of readGeminiSse(body)) {
        const error = chunkError(chunk);
        if (error) throw error;
        const candidate = chunk.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (part.text) yield { type: part.thought ? "thinking_delta" : "text_delta", text: part.text };
        }
        stopReason = stopReasonOf(candidate?.finishReason) ?? stopReason;
      }
    } catch (err) {
      if (request.signal.aborted || err instanceof LlmError) throw err;
      throw new LlmError("internal", "The connection to Gemini broke off mid-answer.");
    }
    yield { type: "done", stopReason };
  }

  /** Opens the HTTP stream. A failure here happens before any event is yielded. */
  private async send(request: LlmRequest): Promise<ReadableStream<Uint8Array>> {
    if (!this.apiKey) throw new LlmError("unavailable", "GEMINI_API_KEY is not set in .env");
    let response: Response;
    try {
      response = await this.fetchFn(`${this.baseUrl}/models/${request.model ?? GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(requestBody(request)),
        signal: request.signal,
      });
    } catch (err) {
      if (request.signal.aborted) throw err;
      throw geminiNetworkError();
    }
    if (!response.ok) throw geminiErrorFromResponse(response.status, await response.text().catch(() => ""), GEMINI_MODEL);
    if (!response.body) throw new LlmError("internal", "Gemini sent an empty response.");
    return response.body;
  }
}
