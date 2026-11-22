/**
 * The abstract LLM client (owner decision on #9/#11). Gemini and Claude headless each
 * implement it. Server-only: not part of the API contract in packages/shared.
 * No tools, no system prompt content and no agent logic live here.
 */

export interface LlmMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface LlmRequest {
  /** Full history, oldest first. */
  readonly messages: readonly LlmMessage[];
  /** Optional; the owner supplies it later. Passed through if given. */
  readonly system?: string;
  /** Abort = cancel the call / kill the process. */
  readonly signal: AbortSignal;
}

export type LlmStreamEvent =
  | { readonly type: "thinking_delta"; readonly text: string }
  | { readonly type: "text_delta"; readonly text: string }
  | { readonly type: "done"; readonly stopReason: string };

export interface LlmClient {
  readonly provider: "claude-headless" | "gemini";
  health(): Promise<{ status: "ok" | "unavailable" | "error"; detail: string }>;
  /** Throws LlmError on failure. */
  stream(request: LlmRequest): AsyncIterable<LlmStreamEvent>;
}

export type LlmErrorCode = "unavailable" | "auth" | "rate_limit" | "bad_request" | "internal";

/** The message is plain English and never contains a key. */
export class LlmError extends Error {
  constructor(
    readonly code: LlmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
