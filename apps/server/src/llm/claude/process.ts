import { spawn, type ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeProjectDirToRemove, SANDBOX_PREFIX } from "./projectDir.ts";

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

/**
 * An empty directory for the child's cwd, so it never sees (or touches) the repo. Returned resolved
 * (/private/var/… on macOS), because Claude Code names its project dir after the resolved cwd.
 */
export const makeSandboxDir = async (): Promise<string> => realpath(await mkdtemp(join(tmpdir(), SANDBOX_PREFIX)));

/**
 * Removes what one run left behind: its sandbox dir, and the one `<home>/.claude/projects/<name>` dir
 * Claude Code made for that exact cwd (only if claudeProjectDirToRemove accepts it). Never throws.
 */
export async function cleanupRun(home: string, sandboxCwd: string, configDir?: string): Promise<void> {
  await rm(sandboxCwd, { recursive: true, force: true }).catch(() => {});
  const projectDir = claudeProjectDirToRemove(home, sandboxCwd, configDir);
  if (projectDir) await rm(projectDir, { recursive: true, force: true }).catch(() => {});
}

/** cleanupRun for a synchronous `exit` handler. Never throws. */
export function cleanupRunSync(home: string, sandboxCwd: string, configDir?: string): void {
  const projectDir = claudeProjectDirToRemove(home, sandboxCwd, configDir);
  for (const dir of projectDir ? [sandboxCwd, projectDir] : [sandboxCwd]) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort on the way out
    }
  }
}

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
