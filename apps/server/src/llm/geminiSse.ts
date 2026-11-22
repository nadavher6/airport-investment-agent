/**
 * Reads the Server-Sent Events stream from Gemini's `streamGenerateContent?alt=sse`
 * and yields one parsed JSON chunk per `data:` frame.
 */

/** The parts of a Gemini stream chunk that we use. Everything is optional on the wire. */
export interface GeminiPart {
  readonly text?: string;
  /** True for a thought summary (only sent when thinkingConfig.includeThoughts is on). */
  readonly thought?: boolean;
}

export interface GeminiCandidate {
  readonly content?: { readonly role?: string; readonly parts?: readonly GeminiPart[] };
  readonly finishReason?: string;
}

export interface GeminiChunk {
  readonly candidates?: readonly GeminiCandidate[];
  readonly promptFeedback?: { readonly blockReason?: string };
  /** Gemini can send an error object inside the stream after it has started. */
  readonly error?: { readonly code?: number; readonly status?: string };
}

/** Splits a byte stream into SSE frames and parses each frame's data as JSON. */
export async function* readGeminiSse(body: ReadableStream<Uint8Array>): AsyncGenerator<GeminiChunk> {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");
      let end = buffer.indexOf("\n\n");
      while (end !== -1) {
        const chunk = parseFrame(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (chunk) yield chunk;
        end = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    // A last frame without the closing blank line.
    const tail = parseFrame(buffer);
    if (tail) yield tail;
  } finally {
    // Stops the download when the consumer stops early (abort, or break in the route).
    await reader.cancel().catch(() => undefined);
  }
}

function parseFrame(frame: string): GeminiChunk | undefined {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n");
  if (!data.trim()) return undefined;
  const parsed: unknown = JSON.parse(data);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Gemini sent a stream frame that is not a JSON object");
  }
  return parsed as GeminiChunk;
}
