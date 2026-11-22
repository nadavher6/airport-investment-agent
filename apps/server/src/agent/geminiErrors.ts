/**
 * Errors from the Gemini API, in plain English. Messages never contain the API key
 * or the raw upstream body, so they are safe to show to the user and to log.
 */
export type GeminiErrorKind = "auth" | "quota" | "bad_request" | "upstream" | "network";

/** The HTTP status the server should answer with when this happens before the stream opens. */
export const GEMINI_ERROR_STATUS: Record<GeminiErrorKind, number> = {
  auth: 401,
  quota: 429,
  bad_request: 400,
  upstream: 502,
  network: 502,
};

export class GeminiApiError extends Error {
  constructor(
    readonly kind: GeminiErrorKind,
    message: string,
    /** The status Gemini answered with, if it answered at all. */
    readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }

  get status(): number {
    return GEMINI_ERROR_STATUS[this.kind];
  }
}

/** Gemini's JSON error body: `{ error: { code, message, status, details: [{ reason }] } }`. */
function errorReasons(body: string): string {
  // Only the machine-readable fields are kept; the human message may echo request data.
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

/** Turns a non-2xx Gemini response into a GeminiApiError with a readable message. */
export function geminiErrorFromResponse(status: number, body: string): GeminiApiError {
  const reasons = errorReasons(body);
  // A bad key comes back as 400 INVALID_ARGUMENT with reason API_KEY_INVALID, not only as 401/403.
  if (status === 401 || status === 403 || /API_KEY_INVALID|API_KEY/.test(reasons)) {
    return new GeminiApiError("auth", "Gemini rejected the API key. Check GEMINI_API_KEY in .env.", status);
  }
  if (status === 429) {
    return new GeminiApiError(
      "quota",
      "Gemini free-tier quota reached (rate limit). Wait a minute and try again.",
      status,
    );
  }
  if (status >= 400 && status < 500) {
    return new GeminiApiError("bad_request", `Gemini rejected the request (HTTP ${status}).`, status);
  }
  return new GeminiApiError("upstream", `Gemini is not responding properly right now (HTTP ${status}).`, status);
}

export function geminiNetworkError(): GeminiApiError {
  return new GeminiApiError("network", "Could not reach the Gemini API. Check the network connection.");
}
