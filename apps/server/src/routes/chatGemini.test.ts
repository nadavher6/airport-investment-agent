import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { LlmPassthroughAgent } from "../agent/llmPassthroughAgent.ts";
import { createApp } from "../app.ts";
import { GeminiClient, type FetchLike } from "../llm/geminiClient.ts";
import { offlineClients, parseSse, testConfig, TEST_GEMINI_KEY } from "../test/helpers.ts";

const body = { modelId: "gemini-3.8-flash", messages: [{ role: "user", content: "What makes an airport a good expansion candidate?" }] };

const sse = (texts: string[]): string =>
  texts.map((text, i) => `data: ${JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text }] }, ...(i === texts.length - 1 ? { finishReason: "STOP" } : {}) }] })}\r\n\r\n`).join("");

/** The wiring from index.ts, with a fake fetch in place of the Gemini API: no real call is made. */
function wiredApp(status: number, responseBody: string, withKey = true) {
  const apiKey = withKey ? TEST_GEMINI_KEY : undefined;
  const urls: string[] = [];
  const fetch: FetchLike = async (url) => {
    urls.push(url);
    return new Response(responseBody, { status });
  };
  const config = testConfig(withKey ? ["gemini"] : []);
  const llmClients = { ...offlineClients(), gemini: new GeminiClient({ apiKey, fetch }) };
  return { app: createApp({ config, agent: new LlmPassthroughAgent(llmClients), llmClients }), urls };
}

describe("POST /api/chat with gemini", () => {
  it("streams Gemini's answer as AgentEvents in README order", async () => {
    const { app, urls } = wiredApp(200, sse(["Good candidates ", "are congested."]));
    const res = await request(app).post(API_ROUTES.chat).send(body).expect(200);
    const events = parseSse(res.text);
    expect(events.map((e) => e.type)).toEqual(["message_start", "text_delta", "text_delta", "message_end"]);
    expect(events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("")).toBe("Good candidates are congested.");
    expect(urls).toEqual(["https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse"]);
  });

  it("returns 503 JSON before the stream when Gemini rejects the key, without echoing it", async () => {
    const { app } = wiredApp(400, JSON.stringify({ error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } }));
    const res = await request(app).post(API_ROUTES.chat).send(body).expect(503);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error).toEqual({ code: "model_unavailable", message: expect.stringMatching(/Gemini rejected the API key/) });
    expect(res.text).not.toContain(TEST_GEMINI_KEY);
  });

  it("returns 503 JSON before the stream on a 429 quota error", async () => {
    const res = await request(wiredApp(429, "{}").app).post(API_ROUTES.chat).send(body).expect(503);
    expect(res.body.error.message).toMatch(/quota/i);
  });

  it("returns 503 without calling Gemini when GEMINI_API_KEY is not set", async () => {
    const { app, urls } = wiredApp(200, sse(["unused"]), false);
    const res = await request(app).post(API_ROUTES.chat).send(body).expect(503);
    expect(res.body.error.message).toMatch(/GEMINI_API_KEY is not set/);
    expect(urls).toEqual([]);
  });
});
