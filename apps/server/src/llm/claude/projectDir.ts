import { basename, dirname, isAbsolute, join, resolve } from "node:path";

/** The prefix of every sandbox dir this client creates (see makeSandboxDir). */
export const SANDBOX_PREFIX = "airport-claude-";

/**
 * Claude Code keeps per-project state in `<home>/.claude/projects/<name>`, where `<name>` is the
 * resolved cwd with every character that is not a letter or digit replaced by "-". Checked against a
 * real dir on macOS (claude 2.1.301):
 *   /private/var/folders/c6/8mgg1g5j20x2v9hm_ngmx9w00000gn/T/airport-claude-2SSRep
 *   -> -private-var-folders-c6-8mgg1g5j20x2v9hm-ngmx9w00000gn-T-airport-claude-2SSRep
 * Claude Code shortens very long names (and adds a hash); we never guess those, see below.
 */
export function claudeProjectDirName(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

const MAX_NAME_LENGTH = 200;

/**
 * The one path to delete after a run whose (resolved) cwd was `sandboxCwd`, or undefined to refuse.
 * Pure: no file system access. It refuses unless
 *   - `home` and `sandboxCwd` are absolute,
 *   - the sandbox is one of ours (its last segment starts with SANDBOX_PREFIX),
 *   - the derived name is short enough that Claude Code would not have shortened it,
 *   - the resolved target sits directly under `<configDir>/projects` (configDir = $CLAUDE_CONFIG_DIR when set and absolute,
 *     else `<home>/.claude`) and its last segment is
 *     exactly the derived name (so no "..", no separators, no other dir can be hit).
 */
export function claudeProjectDirToRemove(
  home: string,
  sandboxCwd: string,
  configDir?: string,
): string | undefined {
  if (!isAbsolute(home) || !isAbsolute(sandboxCwd)) return undefined;
  if (configDir !== undefined && !isAbsolute(configDir)) return undefined;
  if (!basename(sandboxCwd).startsWith(SANDBOX_PREFIX)) return undefined;
  const name = claudeProjectDirName(sandboxCwd);
  if (name.length > MAX_NAME_LENGTH || !/^[a-zA-Z0-9-]+$/.test(name)) return undefined;
  if (!name.endsWith(claudeProjectDirName(basename(sandboxCwd)))) return undefined;
  // Claude Code keeps projects under $CLAUDE_CONFIG_DIR when it is set, else under ~/.claude.
  const root = resolve(configDir ?? join(home, ".claude"), "projects");
  const target = resolve(root, name);
  if (dirname(target) !== root || basename(target) !== name) return undefined;
  return target;
}
