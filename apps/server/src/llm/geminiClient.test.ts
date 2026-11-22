import { asModelId, type AgentEvent, type AgentEventType, type ChatRequest, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { collect } from "../test/helpers.ts";
import { GeminiAgent, toGeminiContents, type FetchLike } from "./geminiAgent.ts";
import { GeminiApiError } from "./geminiErrors.ts";

// A fake key: these tests never call the real Gemini API.
const KEY = "test-key-not-real";

const request: ChatRequest = {
  modelId: asModelId("gemini-2.5-flash"),
  messages: [{ role: "user", content: "What makes an airport a good expansion candidate?" }],
};

function model(thinking = true): ModelInfo {
  return {
    id: asModelId("gemini-2.5-flash"),
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "",
    capabilities: { thinking, toolUse: false },
    available: true,
  };
}

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

/** Text as SSE frames the way Gemini sends them (CRLF line endings). */
function sse(chunks: readonly unknown[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join("");
}

function textChunk(text: string, extra: Record<string, unknown> = {}, thought = false): unknown {
  return { candidates: [{ content: { role: "model", parts: [{ text, ...(thought ? { thought: true } : {}) }] }, ...extra }] };
}

/** A fake fetch that records each call and answers with a fixed status and body. */
function fakeFetch(status: number, body: string, calls: Call[] = []): FetchLike {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { "Content-Type": "text/event-stream" } });
  };
}

function run(fetch: FetchLike, thinking = true): Promise<AgentEvent[]> {
  const agent = new GeminiAgent({ apiKey: KEY, fetch });
  return collect(agent.run({ request, model: model(thinking), signal: new AbortController().signal }));
}

const shape = (events: AgentEvent[]): AgentEventType[] =>
  events.map((e) => e.type).filter((t, i, all) => t !== all[i - 1]);

describe("GeminiAgent streaming", () => {
  it("maps thought summaries and text to events in protocol order", async () => {
    const body = sse([
      textChunk("Weighing congestion ", {}, true),
      textChunk("and capacity.", {}, true),
      textChunk("Good candidates have "),
      textChunk("high demand.", { finishReason: "STOP" }),
    ]);
    const events = await run(fakeFetch(200, body));

    expect(shape(events)).toEqual(["message_start", "thinking_delta", "thinking_end", "text_delta", "message_end"]);
    const text = events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("");
    expect(text).toBe("Good candidates have high demand.");
    expect(events.at(-1)).toMatchObject({ type: "message_end", stopReason: "end_turn" });
    expect(new Set(events.map((e) => ("messageId" in e ? e.messageId : ""))).size).toBe(1);
  });

  it("reports max_tokens and closes thinking even when no text follows", async () => {
    const events = await run(fakeFetch(200, sse([textChunk("hmm", { finishReason: "MAX_TOKENS" }, true)])));
    expect(shape(events)).toEqual(["message_start", "thinking_delta", "thinking_end", "message_end"]);
    expect(events.at(-1)).toMatchObject({ stopReason: "max_tokens" });
  });

  it("sends the key only in the x-goog-api-key header, with the full history", async () => {
    const calls: Call[] = [];
    await run(fakeFetch(200, sse([textChunk("ok", { finishReason: "STOP" })]), calls));

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
    expect(call?.url).not.toContain(KEY);
    expect(new Headers(call?.init.headers).get("x-goog-api-key")).toBe(KEY);
    const sent = JSON.parse(String(call?.init.body)) as Record<string, unknown>;
    expect(JSON.stringify(sent)).not.toContain(KEY);
    expect(sent).toMatchObject({
      contents: [{ role: "user", parts: [{ text: request.messages[0]?.content }] }],
      generationConfig: { thinkingConfig: { includeThoughts: true } },
    });
  });

  it("does not ask for thoughts when the model has no thinking capability", async () => {
    const calls: Call[] = [];
    await run(fakeFetch(200, sse([textChunk("ok")]), calls), false);
    expect(JSON.parse(String(calls[0]?.init.body))).not.toHaveProperty("generationConfig");
  });

  it("turns a block or a mid-stream error into an error event", async () => {
    const blocked = await run(fakeFetch(200, sse([textChunk("par"), textChunk("", { finishReason: "SAFETY" })])));
    expect(shape(blocked)).toEqual(["message_start", "text_delta", "error"]);
    expect(blocked.at(-1)).toMatchObject({ error: { message: expect.stringContaining("SAFETY") } });

    const broken = await run(fakeFetch(200, "data: {not json\n\n"));
    expect(shape(broken)).toEqual(["message_start", "error"]);
  });
});

describe("GeminiAgent errors before the stream", () => {
  const badKeyBody = JSON.stringify({
    error: { code: 400, message: "API key not valid.", status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] },
  });

  it.each([
    [400, badKeyBody],
    [401, "{}"],
    [403, "{}"],
  ])("a bad key (HTTP %i) throws a clear auth error and yields no event", async (status, body) => {
    const agent = new GeminiAgent({ apiKey: KEY, fetch: fakeFetch(status, body) });
    const seen: AgentEvent[] = [];
    const error = await (async () => {
      for await (const event of agent.run({ request, model: model(), signal: new AbortController().signal })) {
        seen.push(event);
      }
    })().catch((err: unknown) => err);

    expect(seen).toEqual([]);
    expect(error).toBeInstanceOf(GeminiApiError);
    expect(error).toMatchObject({ kind: "auth", status: 401, message: expect.stringContaining("rejected the API key") });
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it("429 throws the free-tier quota message", async () => {
    await expect(run(fakeFetch(429, '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).rejects.toMatchObject({
      kind: "quota",
      status: 429,
      message: expect.stringContaining("Gemini free-tier quota reached"),
    });
  });

  it("other failures throw readable upstream or network errors", async () => {
    await expect(run(fakeFetch(500, "oops"))).rejects.toMatchObject({ kind: "upstream", status: 502 });
    const offline: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(run(offline)).rejects.toMatchObject({ kind: "network", message: expect.stringContaining("Could not reach") });
  });
});

describe("GeminiAgent abort", () => {
  it("passes the signal to fetch, so an abort cancels the request and ends the run", async () => {
    const controller = new AbortController();
    let fetchSignal: AbortSignal | undefined;
    const encoder = new TextEncoder();
    const fetch: FetchLike = async (_url, init) => {
      fetchSignal = init.signal ?? undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(sse([textChunk("first ")])));
          // Like real fetch: an abort errors the body. The stream never ends on its own.
          init.signal?.addEventListener("abort", () => c.error(init.signal?.reason));
        },
      });
      return new Response(stream, { status: 200 });
    };

    const agent = new GeminiAgent({ apiKey: KEY, fetch });
    const seen: AgentEventType[] = [];
    const consume = (async () => {
      for await (const event of agent.run({ request, model: model(), signal: controller.signal })) {
        seen.push(event.type);
        if (event.type === "text_delta") controller.abort();
      }
    })();

    await expect(consume).rejects.toThrow(/abort/i);
    expect(fetchSignal).toBe(controller.signal);
    expect(fetchSignal?.aborted).toBe(true);
    expect(seen).toEqual(["message_start", "text_delta"]);
  });

  it("cancels the response stream when the consumer stops early", async () => {
    let cancelled = false;
    const fetch: FetchLike = async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new TextEncoder().encode(sse([textChunk("a"), textChunk("b")])));
          },
          cancel() {
            cancelled = true;
          },
        }),
      );
    const agent = new GeminiAgent({ apiKey: KEY, fetch });
    for await (const event of agent.run({ request, model: model(), signal: new AbortController().signal })) {
      if (event.type === "text_delta") break;
    }
    expect(cancelled).toBe(true);
  });
});

describe("Gemini request helpers", () => {
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
