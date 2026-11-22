import type { LlmMessage } from "../llmClient.ts";

/**
 * Arguments for one streamed call. The prompt itself goes to stdin (see formatPrompt).
 * It must behave like an API-key endpoint: prompt in, streamed text and thinking out.
 *   built-in tools off ........ --tools ""
 *   no MCP servers ............ --strict-mcp-config (and never --mcp-config)
 *   no session persistence .... --no-session-persistence
 *   empty temp working dir .... not a flag: the caller spawns the child with cwd = a fresh mkdtemp dir
 * `--setting-sources ""` keeps user/project settings (hooks, permissions) out, as the issue lists.
 * `system` is passed through only when given; nothing in this repo sets it yet.
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
    ...(system !== undefined ? ["--system-prompt", system] : []),
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

/** Env for the child: our own env minus the markers that make `claude` think it is nested in another session. */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const { CLAUDECODE: _nested, CLAUDE_CODE_ENTRYPOINT: _entry, ...rest } = env;
  return rest;
}
