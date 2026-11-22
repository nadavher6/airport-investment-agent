import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { ClaudeConfig } from "../../config.ts";
import { LlmError, type LlmClient, type LlmRequest, type LlmStreamEvent } from "../llmClient.ts";
import { chatClaudeArgs, childEnv, formatPrompt } from "./args.ts";
import { findClaudeBinary } from "./binary.ts";
import { cleanupRun, cleanupRunSync, makeSandboxDir, runCommand, terminate, whenExited, type ChildExit } from "./process.ts";
import { claudeFailure, StreamJsonMapper } from "./streamJson.ts";

export interface ClaudeHeadlessOptions {
  readonly config: ClaudeConfig;
  /**
   * The home dir whose `.claude/projects` holds the per-cwd dir Claude Code makes for each run; it is
   * removed after the run. Required, so tests always pass a temp fake home (index.ts: os.homedir()).
   */
  readonly home: string;
  /** $CLAUDE_CONFIG_DIR, when set: Claude Code then keeps its projects in `<configDir>/projects`, not under home. */
  readonly configDir?: string;
  /** How long a child gets between SIGTERM and SIGKILL. */
  readonly killGraceMs?: number;
  /** How long `claude --version` may take in health(). */
  readonly healthTimeoutMs?: number;
  /** stream() gives up (and kills the child) after this long without a stdout line. */
  readonly idleTimeoutMs?: number;
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
  /** Sandbox dirs of the stream() calls not yet cleaned up, so shutdown() can clean them too. */
  private readonly sandboxes = new Set<string>();
  private readonly killGraceMs: number;
  private readonly idleTimeoutMs: number;

  constructor(private readonly options: ClaudeHeadlessOptions) {
    this.killGraceMs = options.killGraceMs ?? 2000;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 120_000;
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
    const { config, home } = this.options;
    const bin = findClaudeBinary(config);
    if (!bin) throw new LlmError("unavailable", notFound);
    if (signal.aborted) return;

    let child: ChildProcess | undefined;
    const onAbort = () => {
      if (child) terminate(child, this.killGraceMs);
    };
    // Listen before the first await, so an abort while the sandbox is made is never missed.
    signal.addEventListener("abort", onAbort, { once: true });
    let cwd: string;
    try {
      cwd = await makeSandboxDir();
    } catch (err) {
      signal.removeEventListener("abort", onAbort);
      throw new LlmError("internal", `Could not create a temp dir for claude: ${(err as Error).message}`);
    }
    this.sandboxes.add(cwd);

    let exited: Promise<ChildExit> | undefined;
    let idleTimer: NodeJS.Timeout | undefined;
    let idle = false;
    const armIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idle = true;
        if (child) terminate(child, this.killGraceMs);
      }, this.idleTimeoutMs);
      idleTimer.unref();
    };

    try {
      if (signal.aborted) return; // aborted while the sandbox was being made: never spawn
      const spawned = spawn(bin, chatClaudeArgs(config.model, system), { cwd, env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
      child = spawned;
      this.running.add(spawned);
      exited = whenExited(spawned).finally(() => this.running.delete(spawned));
      armIdleTimer();

      let stderr = "";
      spawned.stderr.on("data", (chunk: Buffer) => {
        if (stderr.length < 4000) stderr += chunk.toString();
      });
      spawned.stdin.on("error", () => {}); // EPIPE when the child dies before reading its prompt
      spawned.stdin.end(formatPrompt(messages));

      const mapper = new StreamJsonMapper();
      let stray = "";
      for await (const raw of createInterface({ input: spawned.stdout, crlfDelay: Infinity })) {
        if (signal.aborted) return;
        armIdleTimer();
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
      if (idle) throw new LlmError("unavailable", `Claude sent nothing for ${Math.round(this.idleTimeoutMs / 1000)} s, so the call was stopped.`);
      const exit = await exited;
      if (signal.aborted) return;
      throw exitError(exit, stderr, stray);
    } finally {
      clearTimeout(idleTimer);
      signal.removeEventListener("abort", onAbort);
      if (child) terminate(child, this.killGraceMs);
      if (exited) await exited;
      await cleanupRun(home, cwd, this.options.configDir);
      this.sandboxes.delete(cwd);
    }
  }

  /**
   * Server shutdown: kills every child still running, waits until they are gone, then removes every
   * sandbox (and its Claude project dir) still on disk, so process.exit() cannot outrun the cleanup.
   */
  async shutdown(): Promise<void> {
    const children = [...this.running];
    for (const child of children) terminate(child, this.killGraceMs);
    await Promise.all(children.map(whenExited));
    await Promise.all([...this.sandboxes].map((cwd) => cleanupRun(this.options.home, cwd, this.options.configDir)));
  }

  /** Last resort on process exit: synchronous SIGKILL and synchronous cleanup, so nothing outlives the server. */
  killAllNow(): void {
    for (const child of this.running) child.kill("SIGKILL");
    for (const cwd of this.sandboxes) cleanupRunSync(this.options.home, cwd, this.options.configDir);
  }
}
