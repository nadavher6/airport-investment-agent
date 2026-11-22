import { describe, expect, it } from "vitest";
import { chatClaudeArgs, childEnv, formatPrompt } from "./args.ts";

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

  it("asks for streamed partial messages as stream-json, with the analyst system prompt", () => {
    expect(valueOf(args, "--output-format")).toBe("stream-json");
    expect(args).toContain("--verbose");
    expect(args).toContain("--include-partial-messages");
    expect(valueOf(args, "--system-prompt")).toMatch(/airport investment analyst/);
  });

  it("passes --model only when one is configured", () => {
    expect(args).not.toContain("--model");
    expect(valueOf(chatClaudeArgs("sonnet"), "--model")).toBe("sonnet");
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
  it("drops the nested-session markers and keeps the rest", () => {
    expect(childEnv({ PATH: "/bin", CLAUDECODE: "1", CLAUDE_CODE_ENTRYPOINT: "cli", HOME: "/h" })).toEqual({ PATH: "/bin", HOME: "/h" });
  });
});
