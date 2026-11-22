import { describe, expect, it, vi } from "vitest";
import { readSseData } from "./sse";

function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      controller.close();
    },
  });
}

async function readAll(chunks: (string | Uint8Array)[]): Promise<string[]> {
  const out: string[] = [];
  for await (const data of readSseData(streamOf(chunks))) out.push(data);
  return out;
}

describe("readSseData", () => {
  it("yields each frame's data", async () => {
    expect(await readAll(["data: one\n\ndata: two\n\n"])).toEqual(["one", "two"]);
  });

  it("reassembles a frame split across chunks", async () => {
    expect(await readAll(["da", "ta: {\"a\"", ":1}\n", "\n"])).toEqual(['{"a":1}']);
  });

  it("handles CRLF line endings", async () => {
    expect(await readAll(["data: one\r\n\r\ndata: two\r\n\r\n"])).toEqual(["one", "two"]);
  });

  it("joins multi-line data fields and ignores comments and other fields", async () => {
    expect(await readAll([": keep-alive\n\nevent: x\ndata: line1\ndata: line2\nid: 7\n\n"])).toEqual(["line1\nline2"]);
  });

  it("keeps a multi-byte character intact when its bytes are split across chunks", async () => {
    const bytes = new TextEncoder().encode("data: שלום ✈\n\n");
    const cut = "data: ".length + 1; // between the two bytes of "ש"
    expect(await readAll([bytes.slice(0, cut), bytes.slice(cut)])).toEqual(["שלום ✈"]);
  });

  it("delivers a final frame that has no closing blank line", async () => {
    expect(await readAll(["data: done\n\ndata: last"])).toEqual(["done", "last"]);
    expect(await readAll(["data: done\n\ndata: last\n"])).toEqual(["done", "last"]);
  });

  it("handles CR-only line endings", async () => {
    expect(await readAll(["data: one\r\rdata: two\r\r"])).toEqual(["one", "two"]);
  });

  it("doesn't read a CRLF split across chunks as two line breaks", async () => {
    // "\r" ends chunk 1 and "\n" starts chunk 2. Read as two breaks, this would close the
    // frame after "a" and split one frame into two.
    expect(await readAll(["data: a\r", "\ndata: b\r\n\r\n"])).toEqual(["a\nb"]);
  });

  it("cancels the stream when the consumer stops early", async () => {
    const cancelled = vi.fn();
    const encoder = new TextEncoder();
    const endless = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: first\n\ndata: second\n\n"));
        // Never closes, like a server that's still streaming.
      },
      cancel: cancelled,
    });

    for await (const data of readSseData(endless)) {
      expect(data).toBe("first");
      break;
    }
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
