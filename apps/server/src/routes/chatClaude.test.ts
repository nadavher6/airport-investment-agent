import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { LlmPassthroughAgent } from "../agent/llmPassthroughAgent.ts";
import { createApp } from "../app.ts";
import { ClaudeHeadlessClient } from "../llm/claude/claudeHeadlessClient.ts";
import { fakeClaude, fakeHome, fixtureLines, type FakeClaude, type FakeClaudeSpec } from "../test/fakeClaude.ts";
import { offlineClients, parseSse, testConfig } from "../test/helpers.ts";

const body = (modelId: string) => ({ modelId, messages: [{ role: "user", content: "Hi" }] });

let fake: FakeClaude | undefined;
const home = fakeHome();
afterEach(() => fake?.cleanup());
afterAll(() => home.cleanup());

/** The wiring from index.ts, with a fake `claude` (or none). */
function wiredApp(spec: FakeClaudeSpec | null) {
  fake = spec ? fakeClaude(spec) : undefined;
  const config = testConfig([], { bin: fake?.bin ?? "/nope/claude" });
  const llmClients = { ...offlineClients(), "claude-headless": new ClaudeHeadlessClient({ config: config.claude, home: home.home, killGraceMs: 200 }) };
  return createApp({ config, agent: new LlmPassthroughAgent(llmClients), llmClients });
}

describe("POST /api/chat with claude-headless", () => {
  it("streams the child's answer as AgentEvents", async () => {
    const res = await request(wiredApp({ lines: fixtureLines("stream-thinking-text.jsonl") }))
      .post(API_ROUTES.chat)
      .send(body("claude-headless"))
      .expect(200);
    const events = parseSse(res.text);
    // The fake replays the same fixture to the classifier call too, so it falls back to in_scope (#13).
    expect(events[1]).toMatchObject({ type: "tool_call", name: "classify_message" });
    expect(events[2]).toMatchObject({ type: "tool_result", result: { ok: true, output: { label: "in_scope" } } });
    // ...and the candidate step (#42) falls back to no candidates, so no tool runs before the answer.
    expect(events[3]).toMatchObject({ type: "tool_call", name: "pick_candidates" });
    expect(events[4]).toMatchObject({ type: "tool_result", result: { ok: true, output: { codes: [], fallback: true } } });
    expect(events.map((e) => e.type)).toEqual([
      "message_start",
      "tool_call",
      "tool_result",
      "tool_call",
      "tool_result",
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
    // #22: the classifier call fails first (3 tries), so the error is the classifier's, not Claude's own text.
    expect(res.body.error).toMatchObject({ code: "model_unavailable", message: "The classifier is unavailable right now. Please try again." });
  });

  it("returns 503 when the claude binary is missing", async () => {
    const res = await request(wiredApp(null)).post(API_ROUTES.chat).send(body("claude-headless")).expect(503);
    expect(res.body.error.message).toMatch(/claude binary was not found/);
  });

});
