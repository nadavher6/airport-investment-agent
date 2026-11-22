import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** What the fake `claude` does. Tests never run the real binary. */
export interface FakeClaudeSpec {
  /** stdout for `claude --version`. */
  readonly version?: string;
  readonly versionExitCode?: number;
  /** `claude --version` never answers. */
  readonly versionHang?: boolean;
  /** stdout lines for a `claude -p …` run, written one by one. */
  readonly lines?: readonly string[];
  readonly lineDelayMs?: number;
  readonly stderr?: string;
  readonly exitCode?: number;
  /** Keep running after the lines (until killed). */
  readonly hang?: boolean;
  /** Ignore SIGTERM, so only SIGKILL stops it. */
  readonly ignoreSigterm?: boolean;
  /**
   * Like real Claude Code, create `<projectsRoot>/<cwd with non-alphanumerics as "-">/memory` at start.
   * Tests point it at a temp fake home, never the real ~/.claude.
   */
  readonly projectsRoot?: string;
}

/** What one `-p` run of the fake saw, written to `record.json` next to the script. */
export interface FakeClaudeRecord {
  readonly argv: string[];
  readonly cwd: string;
  /** What was in the cwd when the fake started. */
  readonly cwdEntries: string[];
  readonly stdin: string;
  readonly pid: number;
  /** Names of the env variables the fake was started with (names only, never values). */
  readonly envNames: string[];
  readonly disableAutoMemory: string | null;
}

const SCRIPT = String.raw`
const fs = require("node:fs");
const path = require("node:path");
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, "spec.json"), "utf8"));
const argv = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (argv[0] === "--version") {
  if (spec.versionHang) setInterval(() => {}, 1000);
  else {
    process.stdout.write(spec.version ?? "2.1.0 (Claude Code)\n");
    process.exitCode = spec.versionExitCode ?? 0;
  }
} else {
  if (spec.ignoreSigterm) process.on("SIGTERM", () => {});
  if (spec.projectsRoot) fs.mkdirSync(path.join(spec.projectsRoot, process.cwd().replace(/[^a-zA-Z0-9]/g, "-"), "memory"), { recursive: true });
  let stdin = "";
  process.stdin.on("data", (d) => (stdin += d));
  process.stdin.on("end", async () => {
    fs.writeFileSync(path.join(__dirname, "record.json"), JSON.stringify({ argv, cwd: process.cwd(), cwdEntries: fs.readdirSync(process.cwd()), stdin, pid: process.pid, envNames: Object.keys(process.env), disableAutoMemory: process.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY ?? null }));
    for (const line of spec.lines ?? []) {
      process.stdout.write(line + "\n");
      if (spec.lineDelayMs) await sleep(spec.lineDelayMs);
    }
    if (spec.stderr) process.stderr.write(spec.stderr);
    if (spec.hang) setInterval(() => {}, 1000);
    else process.exitCode = spec.exitCode ?? 0;
  });
}
`;

export interface FakeClaude {
  /** Absolute path to the executable (use as CLAUDE_BIN). */
  readonly bin: string;
  /** The directory holding it (use as PATH). */
  readonly dir: string;
  readRecord(): FakeClaudeRecord | undefined;
  cleanup(): void;
}

/** Writes an executable `claude` (a small Node script) into a fresh temp directory. */
export function fakeClaude(spec: FakeClaudeSpec = {}): FakeClaude {
  const dir = mkdtempSync(join(tmpdir(), "fake-claude-"));
  const bin = join(dir, "claude");
  writeFileSync(join(dir, "spec.json"), JSON.stringify(spec));
  writeFileSync(bin, `#!${process.execPath}\n${SCRIPT}`);
  chmodSync(bin, 0o755);
  const recordPath = join(dir, "record.json");
  return {
    bin,
    dir,
    readRecord: () => (existsSync(recordPath) ? (JSON.parse(readFileSync(recordPath, "utf8")) as FakeClaudeRecord) : undefined),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** A temp dir to use as the client's `home`, so no test ever touches the real ~/.claude. */
export function fakeHome(): { readonly home: string; readonly projectsRoot: string; cleanup(): void } {
  const home = realpathSync(mkdtempSync(join(tmpdir(), "fake-home-")));
  const projectsRoot = join(home, ".claude", "projects");
  mkdirSync(projectsRoot, { recursive: true });
  return { home, projectsRoot, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

/** True while a process with this pid exists. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitFor(check: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** The recorded fixture as stdout lines. */
export function fixtureLines(name: string): string[] {
  const file = new URL(`../llm/claude/fixtures/${name}`, import.meta.url);
  return readFileSync(file, "utf8").split("\n").filter((line) => line.trim() !== "");
}
