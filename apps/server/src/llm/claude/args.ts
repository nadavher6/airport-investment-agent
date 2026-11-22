import type { LlmMessage } from "../llmClient.ts";

/** Used when the request has no `system`: neutral, with no airport or agent content. */
export const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

/**
 * Arguments for one streamed call. The prompt itself goes to stdin (see formatPrompt).
 * It must behave like an API-key endpoint: prompt in, streamed text and thinking out.
 *   built-in tools off ........ --tools ""
 *   no MCP servers ............ --strict-mcp-config (and never --mcp-config)
 *   no session persistence .... --no-session-persistence
 *   empty temp working dir .... not a flag: the caller spawns the child with cwd = a fresh mkdtemp dir
 * `--setting-sources ""` keeps user/project settings (hooks, permissions) out, as the issue lists.
 * `--system-prompt` is ALWAYS passed, so Claude Code's own coding-agent prompt is replaced, never kept or
 * appended to (it describes tools, and with tools off the model then writes tool calls as text):
 * `system` when given, otherwise the neutral DEFAULT_SYSTEM_PROMPT. Nothing in this repo sets `system`.
 */
export function chatClaudeArgs(model: string | undefined, system?: string): string[] {
  return [
    "-p",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--setting-sources",
    "",
    "--tools",
    "",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    ...(model ? ["--model", model] : []),
    "--system-prompt",
    system ?? DEFAULT_SYSTEM_PROMPT,
  ];
}

/**
 * The whole conversation as one prompt, so every turn is a fresh, stateless `claude -p` run.
 * A single user turn is sent as is; a longer history is sent as a tagged transcript.
 */
export function formatPrompt(messages: readonly LlmMessage[]): string {
  const turns = messages.filter((turn) => turn.content.trim() !== "");
  if (turns.length === 1) return turns[0]!.content;
  const transcript = turns.map((turn) => `<${turn.role}>\n${turn.content}\n</${turn.role}>`).join("\n\n");
  return (
    "Here is our conversation so far, oldest first. Reply to the last user message only, " +
    "as the assistant, without repeating the tags.\n\n" +
    transcript
  );
}

/** Exact variable names the child may inherit. */
const ENV_ALLOW = new Set([
  "PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "TMPDIR", "TMP", "TEMP",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
  "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE",
]);
/** Dropped so the child `claude` runs as a plain endpoint when the server was started from inside a Claude Code session. */
const ENV_DROP = new Set(["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]);
const allowed = (name: string): boolean =>
  !ENV_DROP.has(name) && (ENV_ALLOW.has(name) || name.startsWith("LC_") || name.startsWith("CLAUDE_"));

/**
 * Env for the child: an allowlist of our env (system basics, locale, proxies, CLAUDE_*), so provider keys
 * loaded from .env never reach it. In particular an ANTHROPIC_API_KEY would make `claude -p` bill that
 * key instead of the owner's login. CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 stops the per-cwd memory folder.
 */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const kept = Object.entries(env).filter(([name, value]) => value !== undefined && allowed(name));
  return { ...Object.fromEntries(kept), CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" };
}
