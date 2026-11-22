import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { ClaudeConfig } from "../../config.ts";
import { LlmError, type LlmClient, type LlmRequest, type LlmStreamEvent } from "../llmClient.ts";
import { chatClaudeArgs, childEnv, formatPrompt } from "./args.ts";
import { findClaudeBinary } from "./binary.ts";
import { makeSandboxDir, removeSandboxDir, runCommand, terminate, whenExited, type ChildExit } from "./process.ts";
import { claudeFailure, StreamJsonMapper } from "./streamJson.ts";

export interface ClaudeHeadlessOptions {
  readonly config: ClaudeConfig;
  /** How long a child gets between SIGTERM and SIGKILL. */
  readonly killGraceMs?: number;
  /** How long `claude --version` may take in health(). */
  readonly healthTimeoutMs?: number;
}

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function exitError(exit: ChildExit, stderr: string, stray: string): LlmError {
  if (exit.spawnError) return new LlmError("unavailable", `Could not start claude: ${exit.spawnError.message}`);
  const said = `${stderr}\n${stray}`.trim();
  if (said) return claudeFailure(said);
  return new LlmError("internal", exit.signal ? `Claude was stopped (${exit.signal}).` : `Claude exited with code ${exit.code}.`);
}

const notFound = "The claude binary was not found on PATH. Install Claude Code or set CLAUDE_BIN in .env.";

/**
 * A headless Claude Code session that behaves like an API-key endpoint: prompt in, streamed text and
 * thinking out. One `claude -p` child process per stream() call: it starts with the call and is gone when
 * the call ends (finished, failed, aborted, or shutdown()). The full history is sent on every call.
 */
export class ClaudeHeadlessClient implements LlmClient {
  readonly provider = "claude-headless";
  private readonly running = new Set<ChildProcess>();
  private readonly killGraceMs: number;

  constructor(private readonly options: ClaudeHeadlessOptions) {
    this.killGraceMs = options.killGraceMs ?? 2000;
  }

  /** How many `claude` children are alive right now. */
  get runningCount(): number {
    return this.running.size;
  }

  /** Runs `claude --version` (fast, free). Never hangs: it has a timeout of about 5 s. */
  async health(): Promise<{ status: "ok" | "unavailable" | "error"; detail: string }> {
    const bin = findClaudeBinary(this.options.config);
    if (!bin) return { status: "unavailable", detail: notFound };
    const timeoutMs = this.options.healthTimeoutMs ?? 5_000;
    const run = await runCommand(bin, ["--version"], { timeoutMs, env: childEnv() });
    if (run.timedOut) return { status: "error", detail: `claude --version did not answer within ${timeoutMs / 1000} s.` };
    if (run.spawnError) return { status: "unavailable", detail: `Could not start claude: ${run.spawnError.message}` };
    if (run.code !== 0) return { status: "error", detail: claudeFailure(run.stderr || run.stdout).message };
    const version = run.stdout.trim().split(/\s+/)[0];
    return { status: "ok", detail: version ? `Claude Code ${version} is installed.` : "Claude Code is installed." };
  }

  async *stream({ messages, system, signal }: LlmRequest): AsyncGenerator<LlmStreamEvent> {
    const { config } = this.options;
    const bin = findClaudeBinary(config);
    if (!bin) throw new LlmError("unavailable", notFound);
    if (signal.aborted) return;

    const cwd = await makeSandboxDir();
    const child = spawn(bin, chatClaudeArgs(config.model, system), { cwd, env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
    this.running.add(child);
    const exited = whenExited(child).finally(() => this.running.delete(child));
    const onAbort = () => terminate(child, this.killGraceMs);
    signal.addEventListener("abort", onAbort, { once: true });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    child.stdin.on("error", () => {}); // EPIPE when the child dies before reading its prompt
    child.stdin.end(formatPrompt(messages));

    const mapper = new StreamJsonMapper();
    let stray = "";
    try {
      for await (const raw of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
        if (signal.aborted) return;
        const line = parseLine(raw);
        if (line === undefined) {
          if (stray.length < 4000) stray += `${raw}\n`;
          continue;
        }
        yield* mapper.map(line);
        if (mapper.outcome.kind !== "running") break;
      }
      if (mapper.outcome.kind === "done" || signal.aborted) return;
      if (mapper.outcome.kind === "failed") throw mapper.outcome.error;
      const exit = await exited;
      if (signal.aborted) return;
      throw exitError(exit, stderr, stray);
    } finally {
      signal.removeEventListener("abort", onAbort);
      terminate(child, this.killGraceMs);
      await exited;
      await removeSandboxDir(cwd);
    }
  }

  /** Kills every child still running (server shutdown) and waits until they are gone. */
  async shutdown(): Promise<void> {
    const children = [...this.running];
    for (const child of children) terminate(child, this.killGraceMs);
    await Promise.all(children.map(whenExited));
  }

  /** Last resort on process exit: synchronous SIGKILL, so no child outlives the server. */
  killAllNow(): void {
    for (const child of this.running) child.kill("SIGKILL");
  }
}
