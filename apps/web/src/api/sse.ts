/** SSE lines may end in CRLF, LF or a lone CR. */
const LINE_END = /\r\n|\r|\n/;

/**
 * Minimal Server-Sent Events reader for fetch() streams.
 * EventSource can't send a POST body, so we parse the wire format ourselves.
 * Yields the joined `data:` payload of each frame.
 *
 * If the consumer stops early (break, or a throw while handling a frame), the
 * stream is cancelled so the connection closes and the server stops working.
 */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let dataLines: string[] = [];

  const takeFrame = (): string => {
    const data = dataLines.join("\n");
    dataLines = [];
    return data;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      // stream: true keeps multi-byte characters intact across chunk boundaries; the final call flushes.
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

      let match: RegExpExecArray | null;
      while ((match = LINE_END.exec(buffer))) {
        // A trailing CR may be the first half of a CRLF split across chunks: wait for the next one.
        if (!done && match[0] === "\r" && match.index === buffer.length - 1) break;
        const line = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);

        if (line === "") {
          const data = takeFrame();
          if (data) yield data;
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).replace(/^ /, ""));
        }
      }

      if (done) {
        // The stream may end without a closing blank line; still deliver the last frame.
        if (buffer.startsWith("data:")) dataLines.push(buffer.slice(5).replace(/^ /, ""));
        const data = takeFrame();
        if (data) yield data;
        return;
      }
    }
  } finally {
    // No-op if the stream already ended; otherwise closes the connection.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
