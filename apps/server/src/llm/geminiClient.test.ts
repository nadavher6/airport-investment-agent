import { describe, expect, it } from "vitest";
import { collect } from "../test/helpers.ts";
import { GeminiClient, toGeminiContents, type FetchLike } from "./geminiClient.ts";
import { describeLlmClientContract } from "./llmClientContract.ts";
import { LlmError, type LlmRequest, type LlmStreamEvent } from "./llmClient.ts";

// A fake key: these tests never call the real Gemini API.
const KEY = "test-key-not-real";

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

/** Chunks as SSE frames the way Gemini sends them (CRLF line endings). */
function sse(chunks: readonly unknown[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join("");
}

function part(text: string, extra: Record<string, unknown> = {}, thought = false): unknown {
  return { candidates: [{ content: { role: "model", parts: [{ text, ...(thought ? { thought: true } : {}) }] }, ...extra }] };
}

/** A fake fetch that records each call and answers with a fixed status and body. */
function fakeFetch(status: number, body: string, calls: Call[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status });
  };
}

function req(extra: Partial<LlmRequest> = {}): LlmRequest {
  return {
    messages: [{ role: "user", content: "What makes an airport a good expansion candidate?" }],
    signal: new AbortController().signal,
    ...extra,
  };
}

const client = (fetch: FetchLike, apiKey: string | undefined = KEY) => new GeminiClient({ apiKey, fetch });

/** Answers the stream call with one chunk, then keeps the body open until the request is aborted. */
const hangingFetch: FetchLike = async (_url, init) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(sse([part("first ")])));
        init.signal?.addEventListener("abort", () => c.error(init.signal?.reason));
      },
    }),
    { status: 200 },
  );

describeLlmClientContract("GeminiClient (fake fetch)", {
  answering: () => client(fakeFetch(200, sse([part("Good candidates are congested.", { finishReason: "STOP" })]))),
  authFailing: () => client(fakeFetch(403, "{}")),
  unavailable: () => new GeminiClient({ apiKey: undefined, fetch: fakeFetch(200, "") }),
  hanging: () => client(hangingFetch),
});

describe("GeminiClient.stream", () => {
  it("maps thought summaries and text to LlmStreamEvents in order, then done", async () => {
    const body = sse([
      part("Weighing congestion.", {}, true),
      part("Good candidates have "),
      part("high demand.", { finishReason: "STOP" }),
    ]);
    const events = await collect(client(fakeFetch(200, body)).stream(req()));
    expect(events).toEqual<LlmStreamEvent[]>([
      { type: "thinking_delta", text: "Weighing congestion." },
      { type: "text_delta", text: "Good candidates have " },
      { type: "text_delta", text: "high demand." },
      { type: "done", stopReason: "end_turn" },
    ]);
  });

  it("reports max_tokens as the stop reason", async () => {
    const events = await collect(client(fakeFetch(200, sse([part("x", { finishReason: "MAX_TOKENS" })]))).stream(req()));
    expect(events.at(-1)).toEqual({ type: "done", stopReason: "max_tokens" });
  });

  it("sends the key only in the x-goog-api-key header, with the full history", async () => {
    const calls: Call[] = [];
    await collect(client(fakeFetch(200, sse([part("ok")]), calls)).stream(req()));

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
    expect(call?.url).not.toContain(KEY);
    expect(new Headers(call?.init.headers).get("x-goog-api-key")).toBe(KEY);
    expect(String(call?.init.body)).not.toContain(KEY);
    const sent = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
    expect(sent).toEqual({
      contents: [{ role: "user", parts: [{ text: "What makes an airport a good expansion candidate?" }] }],
      generationConfig: { thinkingConfig: { includeThoughts: true } },
    });
  });

  it("passes `system` through only when given", async () => {
    const calls: Call[] = [];
    await collect(client(fakeFetch(200, sse([part("ok")]), calls)).stream(req({ system: "Be brief." })));
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ systemInstruction: { parts: [{ text: "Be brief." }] } });
  });

  it("throws an LlmError for a block or a broken stream after it started", async () => {
    const blocked = client(fakeFetch(200, sse([part("par"), part("", { finishReason: "SAFETY" })]))).stream(req());
    await expect(collect(blocked)).rejects.toMatchObject({ code: "bad_request", message: expect.stringContaining("SAFETY") });

    const broken = client(fakeFetch(200, "data: {not json\n\n")).stream(req());
    await expect(collect(broken)).rejects.toMatchObject({ code: "internal" });
  });
});

describe("GeminiClient errors before the stream", () => {
  const badKeyBody = JSON.stringify({
    error: { code: 400, message: "API key not valid.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] },
  });

  it.each([
    [400, badKeyBody],
    [401, "{}"],
    [403, "{}"],
  ])("a bad key (HTTP %i) throws a clear auth error before any event", async (status, body) => {
    const seen: LlmStreamEvent[] = [];
    const error = await (async () => {
      for await (const event of client(fakeFetch(status, body)).stream(req())) seen.push(event);
    })().catch((err: unknown) => err);

    expect(seen).toEqual([]);
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ code: "auth", message: expect.stringContaining("Gemini rejected the API key") });
    expect((error as Error).message).not.toContain(KEY);
  });

  it("429 throws the free-tier quota message", async () => {
    const stream = client(fakeFetch(429, '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')).stream(req());
    await expect(collect(stream)).rejects.toMatchObject({
      code: "rate_limit",
      message: expect.stringContaining("Gemini free-tier quota reached"),
    });
  });

  it("a missing key, a 5xx and a network failure throw readable errors without calling out", async () => {
    const calls: Call[] = [];
    await expect(collect(client(fakeFetch(200, "", calls), "  ").stream(req()))).rejects.toMatchObject({
      code: "unavailable",
      message: expect.stringContaining("GEMINI_API_KEY"),
    });
    expect(calls).toEqual([]);

    await expect(collect(client(fakeFetch(500, "oops")).stream(req()))).rejects.toMatchObject({ code: "unavailable" });
    const offline: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(collect(client(offline).stream(req()))).rejects.toMatchObject({
      code: "unavailable",
      message: expect.stringContaining("Could not reach"),
    });
  });
});

describe("GeminiClient abort", () => {
  it("passes the signal to fetch, so an abort cancels the request and ends the stream", async () => {
    const controller = new AbortController();
    let fetchSignal: AbortSignal | undefined;
    const fetch: FetchLike = async (_url, init) => {
      fetchSignal = init.signal ?? undefined;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(new TextEncoder().encode(sse([part("first ")])));
          // Like real fetch: an abort errors the body. The stream never ends on its own.
          init.signal?.addEventListener("abort", () => c.error(init.signal?.reason));
        },
      });
      return new Response(body, { status: 200 });
    };

    const seen: string[] = [];
    const consume = (async () => {
      for await (const event of client(fetch).stream(req({ signal: controller.signal }))) {
        seen.push(event.type);
        controller.abort();
      }
    })();

    await expect(consume).rejects.toThrow(/abort/i);
    expect(fetchSignal).toBe(controller.signal);
    expect(fetchSignal?.aborted).toBe(true);
    expect(seen).toEqual(["text_delta"]);
  });

  it("cancels the response body when the consumer stops early", async () => {
    let cancelled = false;
    const fetch: FetchLike = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode(sse([part("a"), part("b")])));
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
    for await (const event of client(fetch).stream(req())) {
      if (event.type === "text_delta") break;
    }
    expect(cancelled).toBe(true);
  });
});

describe("GeminiClient.health", () => {
  it("is unavailable without a key and makes no call", async () => {
    const calls: Call[] = [];
    await expect(client(fakeFetch(200, "{}", calls), "").health()).resolves.toEqual({
      status: "unavailable",
      detail: "GEMINI_API_KEY is not set in .env",
    });
    expect(calls).toEqual([]);
  });

  it("lists one model with the key in the header and reports ok", async () => {
    const calls: Call[] = [];
    await expect(client(fakeFetch(200, '{"models":[]}', calls)).health()).resolves.toEqual({
      status: "ok",
      detail: "Gemini connected",
    });
    expect(calls[0]?.url).toBe("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1");
    expect(new Headers(calls[0]?.init.headers).get("x-goog-api-key")).toBe(KEY);
  });

  it("reports an invalid key, and gives up after the timeout instead of hanging", async () => {
    await expect(client(fakeFetch(403, "{}")).health()).resolves.toEqual({ status: "error", detail: "Gemini: invalid API key" });

    const hanging: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const slow = new GeminiClient({ apiKey: KEY, fetch: hanging, healthTimeoutMs: 20 });
    await expect(slow.health()).resolves.toMatchObject({ status: "error", detail: expect.stringContaining("did not answer") });
  });
});

describe("toGeminiContents", () => {
  it("drops empty turns, maps assistant to model and merges same-role neighbours", () => {
    expect(
      toGeminiContents([
        { role: "user", content: "Q1" },
        { role: "assistant", content: "" },
        { role: "user", content: "Q2" },
        { role: "assistant", content: "A2" },
      ]),
    ).toEqual([
      { role: "user", parts: [{ text: "Q1" }, { text: "Q2" }] },
      { role: "model", parts: [{ text: "A2" }] },
    ]);
  });
});
