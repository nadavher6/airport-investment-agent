import { existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeClaude, fakeHome, fixtureLines, isAlive, waitFor, type FakeClaude, type FakeClaudeSpec } from "../../test/fakeClaude.ts";
import { collect, testConfig } from "../../test/helpers.ts";
import { describeLlmClientContract } from "../llmClientContract.ts";
import { LlmError, type LlmRequest, type LlmStreamEvent } from "../llmClient.ts";
import { DEFAULT_SYSTEM_PROMPT } from "./args.ts";
import { ClaudeHeadlessClient, type ClaudeHeadlessOptions } from "./claudeHeadlessClient.ts";

const textLine = (text: string) =>
  JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text } } });
const authError = JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" });

let cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  vi.unstubAllEnvs();
});

/** A client on a fake `claude` and a temp fake home (never the real ~/.claude). */
function clientWith(
  spec: FakeClaudeSpec | null,
  claude: Parameters<typeof testConfig>[1] = {},
  options: Partial<Pick<ClaudeHeadlessOptions, "idleTimeoutMs">> = {},
) {
  const home = fakeHome();
  cleanups.push(home.cleanup);
  const fake = spec ? fakeClaude({ projectsRoot: home.projectsRoot, ...spec }) : undefined;
  if (fake) cleanups.push(fake.cleanup);
  const config = testConfig([], { bin: fake?.bin ?? "/nope/claude", ...claude }).claude;
  const client = new ClaudeHeadlessClient({ config, home: home.home, killGraceMs: 200, healthTimeoutMs: 500, ...options });
  return { fake: fake!, client, home };
}

/** The project dir name Claude Code uses for a cwd, written out independently of the code under test. */
const projectName = (cwd: string) => cwd.replaceAll("/", "-").replaceAll("_", "-").replaceAll(".", "-");

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
    expect(valueOf("--system-prompt")).toBe(DEFAULT_SYSTEM_PROMPT); // replaces Claude Code's own prompt
    expect(record.argv).not.toContain("--append-system-prompt");
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

  it("always replaces the default system prompt: the neutral one-liner, or `system` when given", async () => {
    const { client, fake } = clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") });
    await collect(client.stream(request()));
    let { argv } = fake.readRecord()!;
    expect(argv.filter((arg) => arg === "--system-prompt")).toHaveLength(1);
    expect(argv[argv.indexOf("--system-prompt") + 1]).toBe("You are a helpful assistant.");
    expect(argv.some((arg) => arg.startsWith("--append-system-prompt"))).toBe(false);

    await collect(client.stream(request(undefined, "Answer in French.")));
    ({ argv } = fake.readRecord()!);
    expect(argv.filter((arg) => arg === "--system-prompt")).toHaveLength(1);
    expect(argv[argv.indexOf("--system-prompt") + 1]).toBe("Answer in French.");
    expect(argv.some((arg) => arg.startsWith("--append-system-prompt"))).toBe(false);
  });

  it("removes only this run's own ~/.claude/projects dir; siblings survive", async () => {
    const { client, fake, home } = clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") });
    const siblings = [
      projectName(join(realpathSync(tmpdir()), "airport-claude-OTHER1")), // another run's dir
      "-Users-someone-code-my-project", // a real project
    ];
    for (const name of siblings) mkdirSync(join(home.projectsRoot, name, "memory"), { recursive: true });

    await collect(client.stream(request()));
    const { cwd } = fake.readRecord()!;
    expect(readdirSync(home.projectsRoot).sort()).toEqual([...siblings].sort());
    expect(existsSync(join(home.projectsRoot, projectName(cwd)))).toBe(false);
    expect(existsSync(cwd)).toBe(false);
  });

  it("passes an allowlisted env: no provider keys, auto-memory off", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-not-a-key");
    vi.stubEnv("GEMINI_API_KEY", "test-not-a-key");
    vi.stubEnv("CLAUDE_CODE_ENTRYPOINT", "cli");
    const { client, fake } = clientWith({ lines: fixtureLines("stream-thinking-text.jsonl") });
    await collect(client.stream(request()));
    const record = fake.readRecord()!;
    expect(record.envNames).not.toContain("ANTHROPIC_API_KEY");
    expect(record.envNames).not.toContain("GEMINI_API_KEY");
    expect(record.envNames).not.toContain("CLAUDE_CODE_ENTRYPOINT");
    expect(record.envNames).toContain("PATH");
    expect(record.disableAutoMemory).toBe("1");
  });

  it("stops with an unavailable LlmError when claude sends nothing for idleTimeoutMs", { timeout: 5000 }, async () => {
    const { client, fake } = clientWith({ hang: true }, {}, { idleTimeoutMs: 300 });
    const err = await collect(client.stream(request())).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err).toMatchObject({ code: "unavailable", message: expect.stringMatching(/sent nothing/) });
    const { pid, cwd } = fake.readRecord()!;
    expect(isAlive(pid)).toBe(false);
    expect(existsSync(cwd)).toBe(false);
    expect(client.runningCount).toBe(0);
  });

  it("never starts the child when the abort comes while the sandbox dir is made", async () => {
    const { client, fake, home } = clientWith({ lines: [textLine("Hello")], hang: true });
    const controller = new AbortController();
    const iterator = client.stream(request(controller.signal))[Symbol.asyncIterator]();
    const step = iterator.next(); // runs up to the mkdtemp await
    controller.abort();
    expect(await step).toEqual({ done: true, value: undefined });
    expect(fake.readRecord()).toBeUndefined();
    expect(client.runningCount).toBe(0);
    expect(readdirSync(home.projectsRoot)).toEqual([]);
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

  it("removes the run's project dir after an abort too", async () => {
    const { client, fake, home } = clientWith({ lines: [textLine("Hello")], hang: true });
    const controller = new AbortController();
    const iterator = client.stream(request(controller.signal))[Symbol.asyncIterator]();
    await startStreaming(iterator);
    expect(readdirSync(home.projectsRoot)).toEqual([projectName(fake.readRecord()!.cwd)]);
    controller.abort();
    await iterator.next();
    expect(readdirSync(home.projectsRoot)).toEqual([]);
  });

  it("shutdown() kills every running child and cleans up its dirs", async () => {
    const { client, fake, home } = clientWith({ lines: [textLine("Hello")], hang: true });
    const iterator = client.stream(request())[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    await client.shutdown();
    expect(isAlive(pid)).toBe(false);
    expect(existsSync(fake.readRecord()!.cwd)).toBe(false); // cleaned before shutdown() resolves
    expect(readdirSync(home.projectsRoot)).toEqual([]);
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
