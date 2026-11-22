import { MAX_CONTENT_LENGTH, MAX_TURNS, type ChatMessage } from "@airport/shared";
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

  it("leaves out a user message that was never sent", () => {
    const unsent: ChatMessage = { ...userMessage("lost", "user-x"), status: "error" };
    const turns = toChatTurns([userMessage("Q1"), assistant([{ type: "text", text: "A1" }]), unsent, userMessage("Q2", "user-2")]);
    expect(turns.map((t) => t.content)).toEqual(["Q1", "A1", "Q2"]);
  });

  it("keeps only the newest MAX_TURNS turns and starts the window on a user turn", () => {
    // 151 turns: u0 a0 u1 a1 … u75. The last 100 start on an assistant turn, which is dropped.
    const messages: ChatMessage[] = [];
    for (let i = 0; i <= 75; i++) {
      messages.push(userMessage(`u${i}`, `user-${i}`));
      if (i < 75) messages.push({ ...assistant([{ type: "text", text: `a${i}` }]), id: `a-${i}` as typeof MSG });
    }
    const turns = toChatTurns(messages);

    expect(turns.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(turns[0]).toEqual({ role: "user", content: "u26" });
    expect(turns.at(-1)).toEqual({ role: "user", content: "u75" });
  });

  it("cuts an over-long assistant answer to the server's content limit", () => {
    const long = assistant([{ type: "text", text: "x".repeat(MAX_CONTENT_LENGTH + 500) }]);
    const [, reply] = toChatTurns([userMessage("Q1"), long, userMessage("Q2", "user-2")]);
    expect(reply!.content).toHaveLength(MAX_CONTENT_LENGTH);
  });
});
