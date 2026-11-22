import { asToolCallId, type AgentEvent, type ToolUseBlock } from "@airport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { chatReducer, initialChatState, type ChatState } from "../../state/chatReducer";
import { MODEL_ID, MSG, userMessage } from "../../test/fixtures";
import { ContentBlockView } from "./ContentBlockView";

/**
 * Tool-call guardrails in the UI (#49): a failed attempt arrives as the usual tool_call +
 * tool_result (ok: false) pair, with no contract change, and shows as a failed card. The
 * successful retry is the next card and the answer text has no raw JSON.
 */

const BAD = asToolCallId("attempt-1");
const RETRY = asToolCallId("attempt-2");
const UI_MESSAGE = "Invalid input for find_airports_by_city: cities.0 — Expected string, received number (invalid_input).";

const guardedRun: AgentEvent[] = [
  { type: "message_start", messageId: MSG, modelId: MODEL_ID },
  { type: "tool_call", messageId: MSG, toolCallId: BAD, name: "find_airports_by_city", input: { cities: [123] } },
  { type: "tool_result", messageId: MSG, toolCallId: BAD, result: { ok: false, errorMessage: UI_MESSAGE } },
  { type: "tool_call", messageId: MSG, toolCallId: RETRY, name: "find_airports_by_city", input: { cities: ["Boston"] } },
  { type: "tool_result", messageId: MSG, toolCallId: RETRY, result: { ok: true, output: { airports: ["BOS"] } } },
  { type: "text_delta", messageId: MSG, delta: "Boston is served by BOS." },
  { type: "message_end", messageId: MSG, stopReason: "end_turn" },
];

function reduce(events: AgentEvent[]): ChatState {
  const sent = chatReducer(initialChatState, { type: "user_sent", message: userMessage("Airports in Boston?") });
  return events.reduce((state, event) => chatReducer(state, { type: "agent_event", event }), sent);
}

describe("guardrail tool cards (#49)", () => {
  it("the reducer turns a failed attempt and its retry into a failed then a succeeded tool block", () => {
    const state = reduce(guardedRun);
    const blocks = state.messages.find((m) => m.role === "assistant")?.blocks ?? [];
    expect(blocks.map((b) => (b.type === "tool_use" ? `${b.type}:${b.status}` : b.type))).toEqual([
      "tool_use:failed",
      "tool_use:succeeded",
      "text",
    ]);
    expect(blocks[0]).toMatchObject({ status: "failed", errorMessage: UI_MESSAGE });
    expect(blocks[2]).toEqual({ type: "text", text: "Boston is served by BOS." });
    expect(state.isStreaming).toBe(false);
  });

  it("renders the failed attempt as a failed card with the message and the error code", async () => {
    const state = reduce(guardedRun);
    const blocks = state.messages.find((m) => m.role === "assistant")?.blocks ?? [];
    const failed = blocks.find((b): b is ToolUseBlock => b.type === "tool_use" && b.status === "failed");
    if (!failed) throw new Error("no failed block");
    const { container } = render(<ContentBlockView block={failed} isLive={false} />);
    const card = container.querySelector(".tool-card");
    expect(card).toHaveAttribute("data-status", "failed");
    await userEvent.click(screen.getByRole("button", { name: /find_airports_by_city/ }));
    expect(within(card as HTMLElement).getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(UI_MESSAGE)).toBeVisible();
    expect(screen.getByText(UI_MESSAGE).textContent).toContain("(invalid_input)");
  });

  it("a card for an unreadable call (no input) still renders as failed", () => {
    const block: ToolUseBlock = {
      type: "tool_use",
      toolCallId: BAD,
      name: "unreadable_tool_call",
      input: {},
      status: "failed",
      errorMessage: "The tool call could not be read: the tool call is not valid JSON (unparseable).",
    };
    render(<ContentBlockView block={block} isLive={false} />);
    expect(screen.getByRole("button", { name: /unreadable_tool_call/ })).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
