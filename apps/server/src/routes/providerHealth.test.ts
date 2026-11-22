import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { ClaudeHeadlessClient } from "../llm/claude/claudeHeadlessClient.ts";
import { fakeClaude, type FakeClaude, type FakeClaudeSpec } from "../test/fakeClaude.ts";
import { scriptedAgent, testConfig } from "../test/helpers.ts";

const route = (provider: string) => API_ROUTES.providerHealth.replace(":provider", provider);

let fake: FakeClaude | undefined;
afterEach(() => fake?.cleanup());

/** The real ClaudeHeadlessClient behind the route, with a fake `claude` (or none). */
function appWithClaude(spec: FakeClaudeSpec | null, providers: Parameters<typeof testConfig>[0] = []) {
  fake = spec ? fakeClaude(spec) : undefined;
  const config = testConfig(providers, { bin: fake?.bin ?? "/nope/claude" });
  const claude = new ClaudeHeadlessClient({ config: config.claude, healthTimeoutMs: 500 });
  return createApp({ config, agent: scriptedAgent([]), llmClients: { "claude-headless": claude } });
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

describe("GET /api/providers/:provider/health (providers without a client)", () => {
  it("is ok for a mock-served provider and unavailable without its key", async () => {
    expect((await request(appWithClaude(null)).get(route("gemini"))).body).toMatchObject({ provider: "gemini", status: "ok" });
    expect((await request(appWithClaude(null, ["groq"])).get(route("gemini"))).body).toMatchObject({ status: "unavailable" });
  });

  it("returns 404 for an unknown provider", async () => {
    const res = await request(appWithClaude(null)).get(route("nope")).expect(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
