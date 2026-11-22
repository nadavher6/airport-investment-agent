import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { LlmPassthroughAgent } from "../agent/llmPassthroughAgent.ts";
import { MockAgent } from "../agent/mockAgent.ts";
import { createApp } from "../app.ts";
import { ClaudeHeadlessClient } from "../llm/claude/claudeHeadlessClient.ts";
import { fakeClaude, fixtureLines, type FakeClaude, type FakeClaudeSpec } from "../test/fakeClaude.ts";
import { parseSse, testConfig } from "../test/helpers.ts";

const body = (modelId: string) => ({ modelId, messages: [{ role: "user", content: "Hi" }] });

let fake: FakeClaude | undefined;
afterEach(() => fake?.cleanup());

/** The wiring from index.ts, with a fake `claude` (or none). */
function wiredApp(spec: FakeClaudeSpec | null) {
  fake = spec ? fakeClaude(spec) : undefined;
  const config = testConfig([], { bin: fake?.bin ?? "/nope/claude" });
  const llmClients = { "claude-headless": new ClaudeHeadlessClient({ config: config.claude, killGraceMs: 200 }) };
  return createApp({ config, agent: new LlmPassthroughAgent(llmClients, new MockAgent(0)), llmClients });
}

describe("POST /api/chat with claude-headless", () => {
  it("streams the child's answer as AgentEvents", async () => {
    const res = await request(wiredApp({ lines: fixtureLines("stream-thinking-text.jsonl") }))
      .post(API_ROUTES.chat)
      .send(body("claude-headless"))
      .expect(200);
    expect(parseSse(res.text).map((e) => e.type)).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_delta",
      "thinking_end",
      "text_delta",
      "text_delta",
      "message_end",
    ]);
  });

  it("returns 503 JSON before the stream when claude is not logged in", async () => {
    const lines = [JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" })];
    const res = await request(wiredApp({ lines, exitCode: 1 })).post(API_ROUTES.chat).send(body("claude-headless")).expect(503);
    expect(res.headers["content-type"]).toMatch(/json/);
    expect(res.body.error).toMatchObject({ code: "model_unavailable", message: expect.stringMatching(/not logged in/i) });
  });

  it("returns 503 when the claude binary is missing", async () => {
    const res = await request(wiredApp(null)).post(API_ROUTES.chat).send(body("claude-headless")).expect(503);
    expect(res.body.error.message).toMatch(/claude binary was not found/);
  });

  it("still uses MockAgent for a non-Claude model", async () => {
    const res = await request(wiredApp(null)).post(API_ROUTES.chat).send(body("gemini-2.5-flash")).expect(200);
    const text = parseSse(res.text)
      .flatMap((e) => (e.type === "text_delta" ? [e.delta] : []))
      .join("");
    expect(text).toMatch(/mock response/);
  });
});
