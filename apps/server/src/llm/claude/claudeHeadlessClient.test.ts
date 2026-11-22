import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { fakeClaude, fixtureLines, isAlive, waitFor, type FakeClaude, type FakeClaudeSpec } from "../../test/fakeClaude.ts";
import { collect, testConfig } from "../../test/helpers.ts";
import { describeLlmClientContract } from "../llmClientContract.ts";
import { LlmError, type LlmRequest, type LlmStreamEvent } from "../llmClient.ts";
import { ClaudeHeadlessClient } from "./claudeHeadlessClient.ts";

const textLine = (text: string) =>
  JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text } } });
const authError = JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" });

let fakes: FakeClaude[] = [];
afterEach(() => {
  for (const fake of fakes) fake.cleanup();
  fakes = [];
});

function clientWith(spec: FakeClaudeSpec | null, claude: Parameters<typeof testConfig>[1] = {}) {
  const fake = spec ? fakeClaude(spec) : undefined;
  if (fake) fakes.push(fake);
  const config = testConfig([], { bin: fake?.bin ?? "/nope/claude", ...claude }).claude;
  return { fake: fake!, client: new ClaudeHeadlessClient({ config, killGraceMs: 200, healthTimeoutMs: 500 }) };
}

const request = (signal = new AbortController().signal, system?: string): LlmRequest => ({
  messages: [{ role: "user", content: "Which airport?" }],
  signal,
  ...(system !== undefined ? { system } : {}),
});

/** Pulls events until the first text delta, so the child is known to be streaming. */
async function startStreaming(iterator: AsyncIterator<LlmStreamEvent>): Promise<void> {
  for (;;) {
    const step = await iterator.next();
    if (step.done) throw new Error("stream ended early");
    if (step.value.type === "text_delta") return;
  }
}

describeLlmClientContract("ClaudeHeadlessClient (fake claude binary)", {
  answering: () => clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") }).client,
  authFailing: () => clientWith({ lines: [authError], exitCode: 1 }).client,
  unavailable: () => clientWith(null).client,
  hanging: () => clientWith({ lines: [textLine("Hello")], hang: true }).client,
});

describe("ClaudeHeadlessClient", () => {
  it("maps the recorded stream-json fixture to thinking, text and done", async () => {
    const { client } = clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") });
    expect(await collect(client.stream(request()))).toEqual([
      { type: "thinking_delta", text: "Weigh congestion " },
      { type: "thinking_delta", text: "and demand." },
      { type: "text_delta", text: "High congestion " },
      { type: "text_delta", text: "and growth." },
      { type: "done", stopReason: "end_turn" },
    ]);
    expect(client.runningCount).toBe(0);
  });

  it("starts the child with tools off, no MCP, no persistence, in an empty temp dir, prompt on stdin", async () => {
    const { client, fake } = clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") });
    await collect(client.stream(request()));
    const record = fake.readRecord()!;
    const valueOf = (flag: string) => record.argv[record.argv.indexOf(flag) + 1];

    expect(record.argv[0]).toBe("-p");
    expect(valueOf("--tools")).toBe(""); // every built-in tool off
    expect(record.argv).toContain("--strict-mcp-config"); // no MCP servers…
    expect(record.argv).not.toContain("--mcp-config"); // …and none given
    expect(record.argv).toContain("--no-session-persistence");
    expect(valueOf("--setting-sources")).toBe("");
    expect(valueOf("--output-format")).toBe("stream-json");
    expect(record.argv).not.toContain("--system-prompt"); // nothing sets one yet
    expect(record.argv).not.toContain("--dangerously-skip-permissions");
    expect(record.stdin).toBe("Which airport?");

    // process.cwd() reports the resolved path (/private/var/… on macOS).
    expect(record.cwd.startsWith(realpathSync(tmpdir()))).toBe(true);
    expect(record.cwd).toMatch(/airport-claude-/);
    expect(record.cwdEntries).toEqual([]);
    expect(existsSync(record.cwd)).toBe(false); // removed after the call
  });

  it("passes `system` and the configured model through when given", async () => {
    const { client, fake } = clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") }, { model: "sonnet" });
    await collect(client.stream(request(undefined, "Be brief.")));
    const { argv } = fake.readRecord()!;
    expect(argv[argv.indexOf("--system-prompt") + 1]).toBe("Be brief.");
    expect(argv[argv.indexOf("--model") + 1]).toBe("sonnet");
  });

  it("kills the child when the request is aborted, leaving no process", async () => {
    const { client, fake } = clientWith({ lines: [textLine("Hello")], hang: true });
    const controller = new AbortController();
    const iterator = client.stream(request(controller.signal))[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    expect(isAlive(pid)).toBe(true);

    controller.abort();
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
    expect(isAlive(pid)).toBe(false);
    expect(client.runningCount).toBe(0);
  });

  it("uses SIGKILL when the child ignores SIGTERM", async () => {
    const { client, fake } = clientWith({ lines: [textLine("Hello")], hang: true, ignoreSigterm: true });
    const controller = new AbortController();
    const iterator = client.stream(request(controller.signal))[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    controller.abort();
    await iterator.next();
    expect(isAlive(pid)).toBe(false);
  });

  it("kills the child when the consumer stops pulling (return())", async () => {
    const { client, fake } = clientWith({ lines: [textLine("Hello")], hang: true });
    const iterator = client.stream(request())[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    await iterator.return?.(undefined);
    expect(isAlive(pid)).toBe(false);
  });

  it("shutdown() kills every running child", async () => {
    const { client, fake } = clientWith({ lines: [textLine("Hello")], hang: true });
    const iterator = client.stream(request())[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    await client.shutdown();
    expect(isAlive(pid)).toBe(false);
    await waitFor(() => client.runningCount === 0);
    await iterator.return?.(undefined);
  });

  it("throws an internal LlmError with the first stderr line when claude exits non-zero", async () => {
    const { client } = clientWith({ lines: [textLine("Half an ans")], stderr: "Error: something broke\n", exitCode: 2 });
    const err = await collect(client.stream(request())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err).toMatchObject({ code: "internal", message: "Error: something broke" });
  });

  describe("health()", () => {
    it("is ok with the version from `claude --version`, without any `claude -p` call", async () => {
      const { client, fake } = clientWith({ version: "2.1.7 (Claude Code)\n" });
      expect(await client.health()).toEqual({ status: "ok", detail: "Claude Code 2.1.7 is installed." });
      expect(fake.readRecord()).toBeUndefined();
    });

    it("is unavailable when the binary is missing", async () => {
      expect(await clientWith(null).client.health()).toMatchObject({ status: "unavailable", detail: expect.stringMatching(/not found/) });
    });

    it("is an error when --version fails", async () => {
      expect(await clientWith({ version: "boom\n", versionExitCode: 1 }).client.health()).toEqual({ status: "error", detail: "boom" });
    });

    it("is an error, not a hang, when --version times out", { timeout: 3000 }, async () => {
      const health = await clientWith({ versionHang: true }).client.health();
      expect(health).toMatchObject({ status: "error", detail: expect.stringMatching(/did not answer/) });
    });
  });
});
