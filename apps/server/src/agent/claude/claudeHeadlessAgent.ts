import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { asMessageId, type AgentEvent } from "@airport/shared";
import type { ClaudeConfig } from "../../config.ts";
import { HttpError } from "../../http/errors.ts";
import type { Agent, AgentRunInput } from "../agent.ts";
import { chatClaudeArgs, childEnv, formatPrompt } from "./args.ts";
import { findClaudeBinary } from "./binary.ts";
import { makeSandboxDir, removeSandboxDir, terminate, whenExited, type ChildExit } from "./process.ts";
import { describeClaudeFailure, StreamJsonMapper } from "./streamJson.ts";

export interface ClaudeHeadlessOptions {
  readonly config: ClaudeConfig;
  /** How long a child gets between SIGTERM and SIGKILL. */
  readonly killGraceMs?: number;
}

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

function exitDetail(exit: ChildExit, stderr: string, stray: string): string {
  if (exit.spawnError) return `Could not start claude: ${exit.spawnError.message}`;
  const said = `${stderr}\n${stray}`.trim();
  if (said) return describeClaudeFailure(said);
  return exit.signal ? `Claude was stopped (${exit.signal}).` : `Claude exited with code ${exit.code}.`;
}

/**
 * The LLM is a headless Claude Code session: one `claude -p` child process per chat request.
 * The child starts when the request arrives and is gone when the request ends (finished, failed,
 * aborted or server shutdown). History is sent in full each turn, so nothing is kept between turns.
 *
 * Errors before the first model output (binary missing, not logged in, too many running) are thrown
 * as HttpError; the chat route pulls the first event before opening the stream, so they become normal
 * 4xx/5xx responses. Later failures are yielded as an `error` event.
 */
export class ClaudeHeadlessAgent implements Agent {
  private readonly running = new Set<ChildProcess>();
  /** Slots taken by runs in progress (taken before any await, so the limit can't be raced). */
  private activeRuns = 0;
  private readonly killGraceMs: number;

  constructor(private readonly options: ClaudeHeadlessOptions) {
    this.killGraceMs = options.killGraceMs ?? 2000;
  }

  /** How many `claude` children are alive right now. */
  get runningCount(): number {
    return this.running.size;
  }

  async *run(input: AgentRunInput): AsyncGenerator<AgentEvent> {
    const { maxConcurrent } = this.options.config;
    if (this.activeRuns >= maxConcurrent) {
      throw new HttpError(
        "too_many_requests",
        `Claude is already answering ${this.activeRuns} request(s), the most allowed at once. Wait for one to finish and try again.`,
      );
    }
    this.activeRuns++;
    try {
      yield* this.runChild(input);
    } finally {
      this.activeRuns--;
    }
  }

  private async *runChild({ request, model, signal }: AgentRunInput): AsyncGenerator<AgentEvent> {
    const { config } = this.options;
    const bin = findClaudeBinary(config);
    if (!bin) throw new HttpError("model_unavailable", "The claude binary was not found. Install Claude Code or set CLAUDE_BIN.");
    if (signal.aborted) return;

    const cwd = await makeSandboxDir();
    const child = spawn(bin, chatClaudeArgs(config.model), { cwd, env: childEnv(), stdio: ["pipe", "pipe", "pipe"] });
    this.running.add(child);
    const exited = whenExited(child).finally(() => this.running.delete(child));
    const onAbort = () => terminate(child, this.killGraceMs);
    signal.addEventListener("abort", onAbort, { once: true });

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    child.stdin.on("error", () => {}); // EPIPE when the child dies before reading its prompt
    child.stdin.end(formatPrompt(request.messages));

    const messageId = asMessageId(randomUUID());
    const mapper = new StreamJsonMapper(messageId);
    let started = false;
    let stray = "";

    try {
      for await (const raw of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
        if (signal.aborted) return;
        const line = parseLine(raw);
        if (line === undefined) {
          if (stray.length < 4000) stray += `${raw}\n`;
          continue;
        }
        const events = mapper.map(line);
        if (mapper.outcome.kind === "failed") break;
        if (!started && mapper.sawContent) {
          started = true;
          yield { type: "message_start", messageId, modelId: model.id };
        }
        yield* events;
        if (mapper.outcome.kind === "done") return;
      }

      const exit = await exited;
      if (signal.aborted) return;
      const detail = mapper.outcome.kind === "failed" ? mapper.outcome.detail : exitDetail(exit, stderr, stray);
      if (!started) throw new HttpError("model_unavailable", detail);
      yield { type: "error", error: { code: "internal", message: detail } };
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
