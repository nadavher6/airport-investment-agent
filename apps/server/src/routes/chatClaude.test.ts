import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { AgentRouter } from "../agent/agentRouter.ts";
import { ClaudeHeadlessAgent } from "../agent/claude/claudeHeadlessAgent.ts";
import { MockAgent } from "../agent/mockAgent.ts";
import { createApp } from "../app.ts";
import { fakeClaude, fixtureLines, waitFor, type FakeClaude, type FakeClaudeSpec } from "../test/fakeClaude.ts";
import { parseSse, startServer, testConfig } from "../test/helpers.ts";

const claudeBody = { modelId: "claude-headless", messages: [{ role: "user", content: "Hi" }] };
const geminiBody = { modelId: "gemini-2.5-flash", messages: [{ role: "user", content: "Hi" }] };

let fake: FakeClaude | undefined;
afterEach(() => fake?.cleanup());

/** The real wiring from index.ts, with a fake `claude`. */
function wiredApp(spec: FakeClaudeSpec | null, maxConcurrent = 2) {
  fake = spec ? fakeClaude(spec) : undefined;
  const config = testConfig([], { bin: fake?.bin ?? "/nope/claude", maxConcurrent });
  const claude = new ClaudeHeadlessAgent({ config: config.claude, killGraceMs: 200 });
  const app = createApp({ config, agent: new AgentRouter({ "claude-headless": claude }, new MockAgent(0)) });
  return { app, claude };
}

describe("POST /api/chat with claude-headless", () => {
  it("streams the child's answer as AgentEvents", async () => {
    const { app } = wiredApp({ lines: fixtureLines("stream-thinking-text.jsonl") });
    const res = await request(app).post(API_ROUTES.chat).send(claudeBody).expect(200);
    const types = parseSse(res.text).map((e) => e.type);
    expect(types).toEqual(["message_start", "thinking_delta", "thinking_delta", "thinking_end", "text_delta", "text_delta", "message_end"]);
  });

  it("returns 503 before the stream when claude is not logged in", async () => {
    const lines = [JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" })];
    const { app } = wiredApp({ lines, exitCode: 1 });
    const res = await request(app).post(API_ROUTES.chat).send(claudeBody).expect(503);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error).toMatchObject({ code: "model_unavailable", message: expect.stringMatching(/not logged in/i) });
  });

  it("returns 503 when the claude binary is missing", async () => {
    const { app } = wiredApp(null);
    const res = await request(app).post(API_ROUTES.chat).send(claudeBody).expect(503);
    expect(res.body.error.message).toMatch(/claude binary was not found/);
  });

  it("returns 429 before the stream when the concurrency limit is reached", { timeout: 5000 }, async () => {
    const hanging = JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "…" } } });
    const { app, claude } = wiredApp({ lines: [hanging], hang: true }, 1);
    const server = await startServer(app);
    const client = new AbortController();
    try {
      const first = await fetch(`${server.url}${API_ROUTES.chat}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claudeBody),
        signal: client.signal,
      });
      expect(first.status).toBe(200);
      await first.body!.getReader().read();

      const second = await fetch(`${server.url}${API_ROUTES.chat}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claudeBody),
      });
      expect(second.status).toBe(429);
      expect(await second.json()).toEqual({
        error: { code: "too_many_requests", message: expect.stringMatching(/most allowed at once/) },
      });

      // Closing the first stream kills its child and frees the slot.
      client.abort();
      await waitFor(() => claude.runningCount === 0);
    } finally {
      await server.close();
    }
  });

  it("still uses MockAgent for a non-Claude model", async () => {
    const { app } = wiredApp(null);
    const res = await request(app).post(API_ROUTES.chat).send(geminiBody).expect(200);
    const text = parseSse(res.text)
      .flatMap((e) => (e.type === "text_delta" ? [e.delta] : []))
      .join("");
    expect(text).toMatch(/mock response/);
  });
});
