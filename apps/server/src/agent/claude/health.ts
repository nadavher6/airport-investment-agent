import { nowIso, type ProviderHealthResponse } from "@airport/shared";
import type { ClaudeConfig } from "../../config.ts";
import { baseClaudeArgs, childEnv } from "./args.ts";
import { findClaudeBinary } from "./binary.ts";
import { makeSandboxDir, removeSandboxDir, runCommand } from "./process.ts";
import { describeClaudeFailure } from "./streamJson.ts";

export interface ClaudeHealthOptions {
  /** Also run one tiny `claude -p` call, to prove the login works. Costs one small request. */
  readonly deep: boolean;
  readonly versionTimeoutMs?: number;
  readonly deepTimeoutMs?: number;
}

const result = (status: ProviderHealthResponse["status"], detail: string, version?: string): ProviderHealthResponse => ({
  provider: "claude-headless",
  status,
  detail,
  checkedAt: nowIso(),
  ...(version ? { version } : {}),
});

/** Reads `{"is_error":…, "result":…}` from `claude -p --output-format json`. */
function parseJsonResult(stdout: string): { isError: boolean; text: string } | undefined {
  try {
    const parsed = JSON.parse(stdout.trim()) as { is_error?: unknown; result?: unknown };
    return { isError: parsed.is_error === true, text: typeof parsed.result === "string" ? parsed.result : "" };
  } catch {
    return undefined;
  }
}

/** Never hangs: every command has a timeout (about 5 s for --version, 30 s for the deep check). */
export async function checkClaudeHealth(config: ClaudeConfig, options: ClaudeHealthOptions): Promise<ProviderHealthResponse> {
  const bin = findClaudeBinary(config);
  if (!bin) {
    return result("unavailable", "The claude binary was not found on PATH. Install Claude Code or set CLAUDE_BIN in .env.");
  }

  const versionTimeoutMs = options.versionTimeoutMs ?? 5_000;
  const run = await runCommand(bin, ["--version"], { timeoutMs: versionTimeoutMs, env: childEnv() });
  if (run.timedOut) return result("error", `claude --version did not answer within ${versionTimeoutMs / 1000} s.`);
  if (run.spawnError) return result("unavailable", `Could not start claude: ${run.spawnError.message}`);
  if (run.code !== 0) return result("error", describeClaudeFailure(run.stderr || run.stdout));
  const version = run.stdout.trim().split(/\s+/)[0] || undefined;

  if (!options.deep) return result("ok", `Claude Code ${version ?? ""} is installed.`.replace("  ", " "), version);

  const deepTimeoutMs = options.deepTimeoutMs ?? 30_000;
  const cwd = await makeSandboxDir();
  try {
    // The prompt goes right after -p: `--tools ""` takes a list and would swallow a trailing positional.
    const [print, ...rest] = baseClaudeArgs(config.model);
    const args = [print!, "Reply with OK", ...rest, "--output-format", "json"];
    const deep = await runCommand(bin, args, { timeoutMs: deepTimeoutMs, cwd, env: childEnv() });
    if (deep.timedOut) return result("error", `Claude did not answer a test prompt within ${deepTimeoutMs / 1000} s.`, version);
    const parsed = parseJsonResult(deep.stdout);
    if (deep.code !== 0 || !parsed || parsed.isError) {
      return result("error", describeClaudeFailure(parsed?.text || deep.stderr || deep.stdout), version);
    }
    return result("ok", `Claude Code ${version ?? ""} is installed and logged in.`.replace("  ", " "), version);
  } finally {
    await removeSandboxDir(cwd);
  }
}
