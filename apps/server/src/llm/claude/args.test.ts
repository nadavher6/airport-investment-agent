import { describe, expect, it } from "vitest";
import { chatClaudeArgs, childEnv, DEFAULT_SYSTEM_PROMPT, formatPrompt } from "./args.ts";

/** The value right after a flag, e.g. valueOf(args, "--tools"). */
const valueOf = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("chatClaudeArgs", () => {
  const args = chatClaudeArgs(undefined);

  it("turns off every built-in tool, MCP, settings and session persistence", () => {
    expect(args[0]).toBe("-p");
    expect(valueOf(args, "--tools")).toBe("");
    expect(args).toContain("--strict-mcp-config");
    expect(args).not.toContain("--mcp-config");
    expect(args).toContain("--no-session-persistence");
    expect(valueOf(args, "--setting-sources")).toBe("");
    expect(args).not.toContain("--dangerously-skip-permissions");
  });

  it("asks for streamed partial messages as stream-json", () => {
    expect(valueOf(args, "--output-format")).toBe("stream-json");
    expect(args).toContain("--verbose");
    expect(args).toContain("--include-partial-messages");
  });

  it("passes --model only when one is configured", () => {
    expect(args).not.toContain("--model");
    expect(valueOf(chatClaudeArgs("sonnet"), "--model")).toBe("sonnet");
  });

  it("always replaces Claude Code's system prompt: `system` when given, else the neutral default", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toBe("You are a helpful assistant.");
    expect(valueOf(args, "--system-prompt")).toBe(DEFAULT_SYSTEM_PROMPT);
    expect(valueOf(chatClaudeArgs(undefined, "Be brief."), "--system-prompt")).toBe("Be brief.");
    for (const a of [args, chatClaudeArgs(undefined, "Be brief.")]) {
      expect(a.filter((arg) => arg === "--system-prompt")).toHaveLength(1);
      expect(a.some((arg) => arg.startsWith("--append-system-prompt"))).toBe(false);
    }
  });
});

describe("formatPrompt", () => {
  it("sends a single user turn as is", () => {
    expect(formatPrompt([{ role: "user", content: "Rank SFO" }])).toBe("Rank SFO");
  });

  it("sends a longer history as a tagged transcript, skipping empty turns", () => {
    const prompt = formatPrompt([
      { role: "user", content: "Rank SFO" },
      { role: "assistant", content: "" },
      { role: "user", content: "And LAX?" },
      { role: "assistant", content: "LAX is busy." },
      { role: "user", content: "Compare them" },
    ]);
    expect(prompt).toContain("<user>\nRank SFO\n</user>\n\n<user>\nAnd LAX?\n</user>");
    expect(prompt).toContain("<assistant>\nLAX is busy.\n</assistant>");
    expect(prompt).not.toContain("<assistant>\n\n</assistant>");
    expect(prompt.trimEnd().endsWith("<user>\nCompare them\n</user>")).toBe(true);
  });
});

describe("childEnv", () => {
  it("keeps only allowlisted names, drops the nested-session markers, turns auto-memory off", () => {
    const env = childEnv({
      PATH: "/bin",
      HOME: "/h",
      LC_ALL: "en_US.UTF-8",
      HTTPS_PROXY: "http://proxy",
      CLAUDE_CONFIG_DIR: "/c",
      CLAUDECODE: "1",
      CLAUDE_CODE_ENTRYPOINT: "cli",
      ANTHROPIC_API_KEY: "not-a-key",
      GEMINI_API_KEY: "not-a-key",
      OPENROUTER_API_KEY: "not-a-key",
      SOMETHING_ELSE: "x",
    });
    expect(env).toEqual({
      PATH: "/bin",
      HOME: "/h",
      LC_ALL: "en_US.UTF-8",
      HTTPS_PROXY: "http://proxy",
      CLAUDE_CONFIG_DIR: "/c",
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
    });
  });
});
