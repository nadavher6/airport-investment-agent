import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { asModelId, type AgentEvent, type ChatRequest, type ModelInfo } from "@airport/shared";
import { afterEach, describe, expect, it } from "vitest";
import { HttpError } from "../../http/errors.ts";
import { fakeClaude, fixtureLines, isAlive, waitFor, type FakeClaude, type FakeClaudeSpec } from "../../test/fakeClaude.ts";
import { collect, testConfig } from "../../test/helpers.ts";
import { ClaudeHeadlessAgent } from "./claudeHeadlessAgent.ts";

const model: ModelInfo = {
  id: asModelId("claude-headless"),
  label: "Claude (headless session)",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: true },
  available: true,
};
const request: ChatRequest = { modelId: model.id, messages: [{ role: "user", content: "Which airport?" }] };
const streamLine = (text: string) =>
  JSON.stringify({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text } } });

let fakes: FakeClaude[] = [];
afterEach(() => {
  for (const fake of fakes) fake.cleanup();
  fakes = [];
});

function setup(spec: FakeClaudeSpec, claude: Parameters<typeof testConfig>[1] = {}) {
  const fake = fakeClaude(spec);
  fakes.push(fake);
  const agent = new ClaudeHeadlessAgent({ config: testConfig([], { bin: fake.bin, ...claude }).claude, killGraceMs: 200 });
  return { fake, agent };
}

const run = (agent: ClaudeHeadlessAgent, signal = new AbortController().signal) => agent.run({ request, model, signal });

/** Pulls events until the first text delta, so the child is known to be streaming. */
async function startStreaming(iterator: AsyncIterator<AgentEvent>): Promise<AgentEvent[]> {
  const seen: AgentEvent[] = [];
  for (;;) {
    const step = await iterator.next();
    if (step.done) throw new Error("stream ended early");
    seen.push(step.value);
    if (step.value.type === "text_delta") return seen;
  }
}

describe("ClaudeHeadlessAgent", () => {
  it("maps the recorded stream-json fixture to message_start, thinking, text deltas and end", async () => {
    const { agent } = setup({ lines: fixtureLines("stream-thinking-text.jsonl") });
    const events = await collect(run(agent));
    expect(events.map((e) => e.type)).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_delta",
      "thinking_end",
      "text_delta",
      "text_delta",
      "message_end",
    ]);
    expect(events[0]).toMatchObject({ type: "message_start", modelId: model.id });
    const text = events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("");
    expect(text).toBe("High congestion and growth.");
    expect(agent.runningCount).toBe(0);
  });

  it("starts the child with tools off, no MCP, no persistence, in an empty temp dir, prompt on stdin", async () => {
    const { agent, fake } = setup({ lines: fixtureLines("stream-thinking-text.jsonl") }, { model: "sonnet" });
    await collect(run(agent));
    const record = fake.readRecord()!;

    const valueOf = (flag: string) => record.argv[record.argv.indexOf(flag) + 1];
    expect(record.argv[0]).toBe("-p");
    expect(valueOf("--tools")).toBe("");
    expect(valueOf("--setting-sources")).toBe("");
    expect(valueOf("--output-format")).toBe("stream-json");
    expect(valueOf("--model")).toBe("sonnet");
    expect(record.argv).toEqual(expect.arrayContaining(["--strict-mcp-config", "--no-session-persistence"]));
    expect(record.argv).not.toContain("--mcp-config");
    expect(record.stdin).toBe("Which airport?");

    // process.cwd() reports the resolved path (/private/var/… on macOS).
    expect(record.cwd.startsWith(realpathSync(tmpdir()))).toBe(true);
    expect(record.cwd).toMatch(/airport-claude-/);
    expect(record.cwdEntries).toEqual([]);
    expect(existsSync(record.cwd)).toBe(false); // removed after the run
  });

  it("kills the child when the request is aborted, leaving no process", async () => {
    const { agent, fake } = setup({ lines: [streamLine("Hello")], hang: true });
    const controller = new AbortController();
    const iterator = run(agent, controller.signal)[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    expect(isAlive(pid)).toBe(true);

    controller.abort();
    expect(await iterator.next()).toEqual({ done: true, value: undefined });
    expect(isAlive(pid)).toBe(false);
    expect(agent.runningCount).toBe(0);
  });

  it("uses SIGKILL when the child ignores SIGTERM", async () => {
    const { agent, fake } = setup({ lines: [streamLine("Hello")], hang: true, ignoreSigterm: true });
    const controller = new AbortController();
    const iterator = run(agent, controller.signal)[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;

    controller.abort();
    await iterator.next();
    expect(isAlive(pid)).toBe(false);
  });

  it("kills the child when the consumer stops pulling (return())", async () => {
    const { agent, fake } = setup({ lines: [streamLine("Hello")], hang: true });
    const iterator = run(agent)[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;
    await iterator.return?.(undefined);
    expect(isAlive(pid)).toBe(false);
  });

  it("shutdown() kills every running child", async () => {
    const { agent, fake } = setup({ lines: [streamLine("Hello")], hang: true });
    const iterator = run(agent)[Symbol.asyncIterator]();
    await startStreaming(iterator);
    const { pid } = fake.readRecord()!;

    await agent.shutdown();
    expect(isAlive(pid)).toBe(false);
    await waitFor(() => agent.runningCount === 0);
    await iterator.return?.(undefined);
  });

  it("refuses a run beyond the concurrency limit before starting a process", async () => {
    const { agent } = setup({ lines: [streamLine("Hello")], hang: true }, { maxConcurrent: 1 });
    const first = run(agent)[Symbol.asyncIterator]();
    await startStreaming(first);

    const second = run(agent)[Symbol.asyncIterator]();
    const error = await second.next().catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ code: "too_many_requests", status: 429 });
    expect(agent.runningCount).toBe(1);
    await first.return?.(undefined);
  });

  it("throws a pre-stream HttpError when claude fails before any output (not logged in)", async () => {
    const { agent } = setup({
      lines: [
        JSON.stringify({ type: "system", subtype: "init" }),
        JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }),
      ],
      exitCode: 1,
    });
    const error = await collect(run(agent)).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ code: "model_unavailable", message: expect.stringMatching(/not logged in/i) });
  });

  it("throws a pre-stream HttpError when claude exits non-zero with only stderr", async () => {
    const { agent } = setup({ stderr: "Error: something broke\n", exitCode: 2 });
    const error = await collect(run(agent)).catch((err: unknown) => err);
    expect(error).toMatchObject({ code: "model_unavailable", message: "Error: something broke" });
  });

  it("throws a pre-stream HttpError when the binary is missing", async () => {
    const agent = new ClaudeHeadlessAgent({ config: testConfig([], { bin: "/nope/claude" }).claude });
    const error = await collect(run(agent)).catch((err: unknown) => err);
    expect(error).toMatchObject({ code: "model_unavailable", message: expect.stringMatching(/not found/) });
  });

  it("yields an error event when claude dies after streaming started", async () => {
    const { agent } = setup({ lines: [streamLine("Half an ans")], stderr: "API Error: overloaded\n", exitCode: 1 });
    const events = await collect(run(agent));
    expect(events.map((e) => e.type)).toEqual(["message_start", "text_delta", "error"]);
    expect(events.at(-1)).toEqual({ type: "error", error: { code: "internal", message: "API Error: overloaded" } });
  });
});
