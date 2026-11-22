import { describe, expect, it } from "vitest";
import { collect } from "../test/helpers.ts";
import { readGeminiSse } from "./geminiSse.ts";

function streamOf(pieces: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const piece of pieces) c.enqueue(encoder.encode(piece));
      c.close();
    },
  });
}

describe("readGeminiSse", () => {
  it("joins frames split across network chunks and handles CRLF and a missing final blank line", async () => {
    const chunks = await collect(
      readGeminiSse(streamOf(['data: {"candidates":[{"fin', 'ishReason":"STOP"}]}\r', "\n\r\n", 'data: {"error":{"code":500}}'])),
    );
    expect(chunks).toEqual([{ candidates: [{ finishReason: "STOP" }] }, { error: { code: 500 } }]);
  });

  it("skips frames without data and rejects frames that are not JSON objects", async () => {
    expect(await collect(readGeminiSse(streamOf([": keep-alive\n\n"])))).toEqual([]);
    await expect(collect(readGeminiSse(streamOf(["data: [1]\n\n"])))).rejects.toThrow(/not a JSON object/);
  });
});
