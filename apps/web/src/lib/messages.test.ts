import type { ChatMessage } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { MSG, TOOL, userMessage } from "../test/fixtures";
import { messageText, toChatTurns } from "./messages";

const assistant = (blocks: ChatMessage["blocks"], status: ChatMessage["status"] = "complete"): ChatMessage => ({
  ...userMessage("", "a"),
  id: MSG,
  role: "assistant",
  blocks,
  status,
});

describe("messageText", () => {
  it("joins text blocks and ignores thinking and tool blocks", () => {
    const message = assistant([
      { type: "thinking", text: "hmm", durationMs: 1 },
      { type: "text", text: "Hello " },
      { type: "tool_use", toolCallId: TOOL, name: "t", input: {}, status: "succeeded", output: null },
      { type: "text", text: "world " },
    ]);
    expect(messageText(message)).toBe("Hello world");
  });
});

describe("toChatTurns", () => {
  it("flattens messages to role + content and drops empty turns", () => {
    const turns = toChatTurns([
      userMessage("Q1"),
      assistant([{ type: "thinking", text: "only thinking" }], "error"),
      assistant([{ type: "text", text: "A1" }]),
      userMessage("Q2", "user-2"),
    ]);
    expect(turns).toEqual([
      { role: "user", content: "Q1" },
      { role: "assistant", content: "A1" },
      { role: "user", content: "Q2" },
    ]);
  });
});
