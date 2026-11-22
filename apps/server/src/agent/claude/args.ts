import type { ChatTurn } from "@airport/shared";

/**
 * Arguments for one streamed chat turn. The prompt itself goes to stdin (see formatPrompt).
 * Safety: no built-in tools (no Bash, file edits or web), no MCP servers, no user/project settings,
 * nothing saved to disk. The caller also runs the child in an empty temp directory.
 */
export function chatClaudeArgs(model: string | undefined): string[] {
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
  ];
}

/**
 * The whole conversation as one prompt, so every turn is a fresh, stateless `claude -p` run.
 * A single user turn is sent as is; a longer history is sent as a tagged transcript.
 */
export function formatPrompt(messages: readonly ChatTurn[]): string {
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
