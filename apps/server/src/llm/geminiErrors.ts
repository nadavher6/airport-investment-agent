import { LlmError } from "./llmClient.ts";

/**
 * Gemini failures as LlmErrors in plain English. Messages never contain the API key
 * or the raw upstream body, so they are safe to show to the user and to log.
 */

/** Only the machine-readable fields of Gemini's error body; its human message may echo request data. */
function errorReasons(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null || !("error" in parsed)) return "";
    const error = parsed.error;
    if (typeof error !== "object" || error === null) return "";
    const status = "status" in error && typeof error.status === "string" ? error.status : "";
    const details = "details" in error && Array.isArray(error.details) ? error.details : [];
    const reasons = details
      .map((d: unknown) => (typeof d === "object" && d !== null && "reason" in d ? String(d.reason) : ""))
      .join(" ");
    return `${status} ${reasons}`;
  } catch {
    return "";
  }
}

export const GEMINI_QUOTA_MESSAGE = "Gemini free-tier quota reached (rate limit). Wait a minute and try again.";

/** Turns a non-2xx Gemini response into an LlmError with a readable message. */
export function geminiErrorFromResponse(status: number, body: string, model?: string): LlmError {
  // A bad key comes back as 400 INVALID_ARGUMENT with reason API_KEY_INVALID, not only as 401/403.
  if (status === 401 || status === 403 || /API_KEY/.test(errorReasons(body))) {
    return new LlmError("auth", "Gemini rejected the API key. Check GEMINI_API_KEY in .env.");
  }
  // Google answers 404 NOT_FOUND for a model this key can no longer use (e.g. "no longer available to new
  // users"), even when the models list still shows it.
  if (status === 404 && model) return new LlmError("unavailable", `Gemini model ${model} is not available for this key.`);
  if (status === 429) return new LlmError("rate_limit", GEMINI_QUOTA_MESSAGE);
  if (status >= 400 && status < 500) return new LlmError("bad_request", `Gemini rejected the request (HTTP ${status}).`);
  if (status === 503) return new LlmError("unavailable", "Gemini is busy right now, please try again.");
  return new LlmError("unavailable", `Gemini is not responding properly right now (HTTP ${status}).`);
}

export function geminiNetworkError(): LlmError {
  return new LlmError("unavailable", "Could not reach the Gemini API. Check the network connection.");
}
