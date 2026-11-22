import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface ChildExit {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  /** Set when the process could not be started at all (e.g. ENOENT). */
  readonly spawnError?: Error;
}

/** Resolves once the child has exited or failed to start. Never rejects. */
export function whenExited(child: ChildProcess): Promise<ChildExit> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve({ code: child.exitCode, signal: child.signalCode });
      return;
    }
    child.once("error", (spawnError) => resolve({ code: null, signal: null, spawnError }));
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
}

export const isRunning = (child: ChildProcess): boolean =>
  child.pid !== undefined && child.exitCode === null && child.signalCode === null;

/** SIGTERM now, SIGKILL after `graceMs` if it is still alive. */
export function terminate(child: ChildProcess, graceMs: number): void {
  if (!isRunning(child)) return;
  child.kill("SIGTERM");
  const timer = setTimeout(() => {
    if (isRunning(child)) child.kill("SIGKILL");
  }, graceMs);
  timer.unref();
  child.once("exit", () => clearTimeout(timer));
}

/** An empty directory for the child's cwd, so it never sees (or touches) the repo. */
export const makeSandboxDir = (): Promise<string> => mkdtemp(join(tmpdir(), "airport-claude-"));
export const removeSandboxDir = (dir: string): Promise<void> => rm(dir, { recursive: true, force: true });

export interface CommandResult extends ChildExit {
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
}

/** Runs a short command with a hard timeout. Resolves at the timeout even if the child is slow to die. */
export async function runCommand(
  bin: string,
  args: readonly string[],
  options: { timeoutMs: number; cwd?: string; env?: NodeJS.ProcessEnv; killGraceMs?: number },
): Promise<CommandResult> {
  const child = spawn(bin, args, { cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), options.timeoutMs);
  });
  const outcome = await Promise.race([whenExited(child), timeout]);
  clearTimeout(timer);
  if (outcome === "timeout") {
    terminate(child, options.killGraceMs ?? 2000);
    return { code: null, signal: null, stdout, stderr, timedOut: true };
  }
  return { ...outcome, stdout, stderr, timedOut: false };
}
