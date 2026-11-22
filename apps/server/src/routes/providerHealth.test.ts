import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { ClaudeHeadlessClient } from "../llm/claude/claudeHeadlessClient.ts";
import { GeminiClient, type FetchLike } from "../llm/geminiClient.ts";
import { fakeClaude, fakeHome, type FakeClaude, type FakeClaudeSpec } from "../test/fakeClaude.ts";
import { offlineClients, scriptedAgent, testConfig } from "../test/helpers.ts";

const route = (provider: string) => API_ROUTES.providerHealth.replace(":provider", provider);

let fake: FakeClaude | undefined;
const home = fakeHome();
afterEach(() => fake?.cleanup());
afterAll(() => home.cleanup());

/** The real ClaudeHeadlessClient behind the route, with a fake `claude` (or none). */
function appWithClaude(spec: FakeClaudeSpec | null, providers: Parameters<typeof testConfig>[0] = []) {
  fake = spec ? fakeClaude(spec) : undefined;
  const config = testConfig(providers, { bin: fake?.bin ?? "/nope/claude" });
  const claude = new ClaudeHeadlessClient({ config: config.claude, home: home.home, healthTimeoutMs: 500 });
  return createApp({ config, agent: scriptedAgent([]), llmClients: { ...offlineClients(), "claude-headless": claude } });
}

/** The real GeminiClient behind the route, with a fake fetch that answers every call with `status`. */
function appWithGemini(apiKey: string | undefined, status: number) {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    return new Response("{}", { status });
  };
  const gemini = new GeminiClient({ apiKey, fetch });
  const app = createApp({ config: testConfig(), agent: scriptedAgent([]), llmClients: { ...offlineClients(), gemini } });
  return { app, calls };
}

describe("GET /api/providers/claude-headless/health", () => {
  it("is ok, with a timestamp, when `claude --version` answers", async () => {
    const res = await request(appWithClaude({ version: "2.1.7 (Claude Code)\n" })).get(route("claude-headless")).expect(200);
    expect(res.body).toEqual({
      provider: "claude-headless",
      status: "ok",
      detail: "Claude Code 2.1.7 is installed.",
      checkedAt: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(res.body.checkedAt))).toBe(false);
  });

  it("is unavailable when the binary is missing", async () => {
    const res = await request(appWithClaude(null)).get(route("claude-headless")).expect(200);
    expect(res.body).toMatchObject({ status: "unavailable", detail: expect.stringMatching(/not found/) });
  });

  it("is an error when --version fails", async () => {
    const res = await request(appWithClaude({ version: "boom\n", versionExitCode: 1 })).get(route("claude-headless"));
    expect(res.body).toMatchObject({ status: "error", detail: "boom" });
  });

  it("is an error, not a hang, when --version times out", { timeout: 3000 }, async () => {
    const res = await request(appWithClaude({ versionHang: true })).get(route("claude-headless"));
    expect(res.body).toMatchObject({ status: "error", detail: expect.stringMatching(/did not answer/) });
  });
});

describe("GET /api/providers/gemini/health", () => {
  it("is ok when the key lists a model", async () => {
    const { app, calls } = appWithGemini("test-key-not-real", 200);
    const res = await request(app).get(route("gemini")).expect(200);
    expect(res.body).toEqual({ provider: "gemini", status: "ok", detail: "Gemini connected", checkedAt: expect.any(String) });
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("test-key-not-real");
    expect(JSON.stringify(res.body)).not.toContain("test-key-not-real");
  });

  it("is an error for a rejected key, and unavailable without one (no call made)", async () => {
    expect((await request(appWithGemini("test-key-not-real", 403).app).get(route("gemini"))).body).toMatchObject({
      status: "error",
      detail: "Gemini: invalid API key",
    });
    const { app, calls } = appWithGemini(undefined, 200);
    expect((await request(app).get(route("gemini"))).body).toMatchObject({ status: "unavailable", detail: expect.stringMatching(/GEMINI_API_KEY/) });
    expect(calls).toEqual([]);
  });
});

describe("GET /api/providers/:provider/health", () => {
  it.each(["nope", "groq", "openrouter"])("returns 404 for an unknown provider (%s)", async (provider) => {
    const res = await request(appWithClaude(null)).get(route(provider)).expect(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
