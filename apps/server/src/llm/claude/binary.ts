import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { ClaudeConfig } from "../../config.ts";

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Where the `claude` binary is, or undefined when it isn't installed.
 * CLAUDE_BIN wins: a path is used as is, a bare name is looked up on PATH.
 */
export function findClaudeBinary(config: ClaudeConfig): string | undefined {
  const name = config.bin ?? "claude";
  if (name.includes("/")) return isExecutableFile(name) ? name : undefined;
  for (const dir of config.searchPath.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return undefined;
}
