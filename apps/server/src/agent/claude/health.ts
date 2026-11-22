import { nowIso, type ProviderHealthResponse } from "@airport/shared";
import type { ClaudeConfig } from "../../config.ts";
import { childEnv } from "./args.ts";
import { findClaudeBinary } from "./binary.ts";
import { runCommand } from "./process.ts";
import { describeClaudeFailure } from "./streamJson.ts";

const result = (status: ProviderHealthResponse["status"], detail: string, version?: string): ProviderHealthResponse => ({
  provider: "claude-headless",
  status,
  detail,
  checkedAt: nowIso(),
  ...(version ? { version } : {}),
});

/** Runs `claude --version` (fast, free). Never hangs: it has a timeout of about 5 s. */
export async function checkClaudeHealth(config: ClaudeConfig, timeoutMs = 5_000): Promise<ProviderHealthResponse> {
  const bin = findClaudeBinary(config);
  if (!bin) {
    return result("unavailable", "The claude binary was not found on PATH. Install Claude Code or set CLAUDE_BIN in .env.");
  }
  const run = await runCommand(bin, ["--version"], { timeoutMs, env: childEnv() });
  if (run.timedOut) return result("error", `claude --version did not answer within ${timeoutMs / 1000} s.`);
  if (run.spawnError) return result("unavailable", `Could not start claude: ${run.spawnError.message}`);
  if (run.code !== 0) return result("error", describeClaudeFailure(run.stderr || run.stdout));
  const version = run.stdout.trim().split(/\s+/)[0];
  return version ? result("ok", `Claude Code ${version} is installed.`, version) : result("ok", "Claude Code is installed.");
}
