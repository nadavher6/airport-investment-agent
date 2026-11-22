import type { AgentEvent } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { fullRun, MODEL_ID, MSG, TOOL, userMessage } from "../test/fixtures";
import { chatReducer, initialChatState, type ChatAction, type ChatState } from "./chatReducer";

const sent: ChatAction = { type: "user_sent", message: userMessage("How busy is SFO?") };

function run(events: AgentEvent[], from: ChatState = chatReducer(initialChatState, sent)): ChatState {
  return events.reduce((state, event) => chatReducer(state, { type: "agent_event", event }), from);
}

const assistant = (state: ChatState) => state.messages.find((m) => m.role === "assistant")!;

describe("chatReducer", () => {
  it("user_sent appends the message, starts streaming and clears the last error", () => {
    const failed = { ...initialChatState, lastError: { code: "internal" as const, message: "x" } };
    const state = chatReducer(failed, sent);
    expect(state.messages).toHaveLength(1);
    expect(state.isStreaming).toBe(true);
    expect(state.lastError).toBeNull();
  });

  it("builds ordered blocks from a full run", () => {
    const state = run(fullRun);
    const message = assistant(state);

    expect(state.isStreaming).toBe(false);
    expect(message).toMatchObject({ id: MSG, role: "assistant", status: "complete", modelId: MODEL_ID });
    expect(message.blocks).toEqual([
      { type: "thinking", text: "Let me check.", durationMs: 1200 },
      { type: "tool_use", toolCallId: TOOL, name: "search_airports", input: { query: "SFO" }, status: "succeeded", output: { count: 1 } },
      { type: "text", text: "SFO is congested." },
    ]);
  });

  it("keeps the message streaming with an open thinking block until thinking_end", () => {
    const state = run(fullRun.slice(0, 3));
    expect(assistant(state).status).toBe("streaming");
    expect(assistant(state).blocks).toEqual([{ type: "thinking", text: "Let me check." }]);
  });

  it("starts a new thinking block after a finished one instead of extending it", () => {
    const state = run([
      ...fullRun.slice(0, 4),
      { type: "thinking_delta", messageId: MSG, delta: "More." },
    ]);
    expect(assistant(state).blocks.map((b) => b.type)).toEqual(["thinking", "thinking"]);
  });

  it("starts a new text block when text resumes after a tool call", () => {
    const state = run([
      fullRun[0]!,
      { type: "text_delta", messageId: MSG, delta: "Checking. " },
      fullRun[4]!,
      fullRun[5]!,
      { type: "text_delta", messageId: MSG, delta: "Done." },
    ]);
    expect(assistant(state).blocks.map((b) => b.type)).toEqual(["text", "tool_use", "text"]);
  });

  it("marks a tool block failed with its error message", () => {
    const state = run([
      fullRun[0]!,
      fullRun[4]!,
      { type: "tool_result", messageId: MSG, toolCallId: TOOL, result: { ok: false, errorMessage: "API down" } },
    ]);
    expect(assistant(state).blocks[0]).toMatchObject({ type: "tool_use", status: "failed", errorMessage: "API down" });
  });

  it("ignores events for a message it doesn't know", () => {
    const before = run(fullRun.slice(0, 1));
    const after = run([{ type: "text_delta", messageId: MSG.replace("1", "2") as typeof MSG, delta: "x" }], before);
    expect(after.messages).toEqual(before.messages);
  });

  it("message_end with stopReason cancelled marks the message cancelled", () => {
    const state = run([fullRun[0]!, { type: "message_end", messageId: MSG, stopReason: "cancelled" }]);
    expect(assistant(state).status).toBe("cancelled");
  });

  it("an error event settles the streaming message and records the error", () => {
    const error = { code: "internal" as const, message: "The agent failed mid-response" };
    const state = run([fullRun[0]!, { type: "error", error }]);
    expect(state.isStreaming).toBe(false);
    expect(assistant(state).status).toBe("error");
    expect(state.lastError).toEqual(error);
  });

  it("stream_cancelled marks the in-flight message cancelled and leaves finished ones alone", () => {
    const state = chatReducer(run(fullRun.slice(0, 2)), { type: "stream_cancelled" });
    expect(state.isStreaming).toBe(false);
    expect(assistant(state).status).toBe("cancelled");
    expect(state.messages[0]!.status).toBe("complete");
  });

  it("stream_failed before any agent event records the error without inventing a message", () => {
    const error = { code: "internal" as const, message: "Couldn't reach the API server." };
    const state = chatReducer(chatReducer(initialChatState, sent), { type: "stream_failed", error });
    expect(state.messages).toHaveLength(1);
    expect(state.isStreaming).toBe(false);
    expect(state.lastError).toEqual(error);
  });

  it("marks the user's message unsent when the request fails before any reply", () => {
    const error = { code: "bad_request" as const, message: "Bad" };
    const state = chatReducer(chatReducer(initialChatState, sent), { type: "stream_failed", error });
    expect(state.messages[0]!.status).toBe("error");
  });

  it("leaves the user's message sent when the failure comes after the reply started", () => {
    const error = { code: "internal" as const, message: "The agent failed mid-response" };
    const state = run([fullRun[0]!, { type: "error", error }]);
    expect(state.messages[0]!.status).toBe("complete");
    expect(assistant(state).status).toBe("error");
  });

  it("ignores an event type it doesn't know instead of crashing", () => {
    const before = run(fullRun.slice(0, 2));
    const unknown = { type: "usage", messageId: MSG, tokens: 12 } as unknown as AgentEvent;
    expect(chatReducer(before, { type: "agent_event", event: unknown })).toBe(before);
  });

  it("stream_ended is a no-op after a proper message_end", () => {
    const done = run(fullRun);
    expect(chatReducer(done, { type: "stream_ended" })).toBe(done);
  });

  it("stream_ended without message_end flags a truncated response", () => {
    const state = chatReducer(run(fullRun.slice(0, 3)), { type: "stream_ended" });
    expect(state.isStreaming).toBe(false);
    expect(assistant(state).status).toBe("error");
    expect(state.lastError?.message).toBe("The response ended unexpectedly.");
  });

  it("reset returns the initial state", () => {
    expect(chatReducer(run(fullRun), { type: "reset" })).toBe(initialChatState);
  });
});
