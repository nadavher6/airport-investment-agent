import { API_ROUTES } from "@airport/shared";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { fakeClaude, type FakeClaude, type FakeClaudeSpec } from "../test/fakeClaude.ts";
import { scriptedAgent, testConfig } from "../test/helpers.ts";

const route = (provider: string, deep = false) =>
  API_ROUTES.providerHealth.replace(":provider", provider) + (deep ? "?deep=1" : "");

let fake: FakeClaude | undefined;
afterEach(() => fake?.cleanup());

function appWithClaude(spec: FakeClaudeSpec | null, providers: Parameters<typeof testConfig>[0] = []) {
  fake = spec ? fakeClaude(spec) : undefined;
  const config = testConfig(providers, fake ? { bin: fake.bin } : {});
  return createApp({ config, agent: scriptedAgent([]), healthTimeouts: { versionTimeoutMs: 500, deepTimeoutMs: 500 } });
}

describe("GET /api/providers/claude-headless/health", () => {
  it("is ok with the version from `claude --version`", async () => {
    const res = await request(appWithClaude({ version: "2.1.7 (Claude Code)\n" })).get(route("claude-headless")).expect(200);
    expect(res.body).toMatchObject({ provider: "claude-headless", status: "ok", version: "2.1.7" });
    expect(res.body.detail).toBe("Claude Code 2.1.7 is installed.");
    expect(Number.isNaN(Date.parse(res.body.checkedAt))).toBe(false);
    expect(fake!.readRecord()).toBeUndefined(); // no -p run without ?deep=1
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

  it("deep: runs one tiny prompt with tools off and reports logged in", async () => {
    const lines = [JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "OK" })];
    const res = await request(appWithClaude({ lines })).get(route("claude-headless", true)).expect(200);
    expect(res.body).toMatchObject({ status: "ok", detail: expect.stringMatching(/logged in/) });
    const { argv, cwdEntries } = fake!.readRecord()!;
    expect(argv.slice(0, 2)).toEqual(["-p", "Reply with OK"]);
    expect(argv[argv.indexOf("--tools") + 1]).toBe("");
    expect(argv[argv.indexOf("--output-format") + 1]).toBe("json");
    expect(argv).toEqual(expect.arrayContaining(["--strict-mcp-config", "--no-session-persistence"]));
    expect(cwdEntries).toEqual([]);
  });

  it("deep: says 'not logged in' when claude reports an auth error", async () => {
    const lines = [JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Invalid API key · Please run /login" })];
    const res = await request(appWithClaude({ lines, exitCode: 1 })).get(route("claude-headless", true));
    expect(res.body).toMatchObject({ status: "error", detail: expect.stringMatching(/not logged in/) });
  });

  it("deep: is an error, not a hang, when the prompt times out", { timeout: 3000 }, async () => {
    const res = await request(appWithClaude({ hang: true })).get(route("claude-headless", true));
    expect(res.body).toMatchObject({ status: "error", detail: expect.stringMatching(/did not answer/) });
  });
});

describe("GET /api/providers/:provider/health (other providers)", () => {
  it("is ok for a mock-served provider and unavailable without its key", async () => {
    expect((await request(appWithClaude(null)).get(route("gemini"))).body).toMatchObject({ provider: "gemini", status: "ok" });
    expect((await request(appWithClaude(null, ["groq"])).get(route("gemini"))).body).toMatchObject({ status: "unavailable" });
  });

  it("returns 404 for an unknown provider", async () => {
    const res = await request(appWithClaude(null)).get(route("nope")).expect(404);
    expect(res.body.error.code).toBe("not_found");
  });
});
