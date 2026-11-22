import { asMessageId, asToolCallId } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { classificationToolEvents, CLASSIFY_MESSAGE_TOOL } from "./toolEvents.ts";

describe("classificationToolEvents", () => {
  const messageId = asMessageId("m1");

  it("builds a classify_message tool_call / tool_result pair with { label, reason }", () => {
    const [call, result] = classificationToolEvents(
      messageId,
      "hello",
      { label: "greeting", reason: "Says hello." },
      asToolCallId("t1"),
    );
    expect(call).toEqual({ type: "tool_call", messageId, toolCallId: "t1", name: CLASSIFY_MESSAGE_TOOL, input: { message: "hello" } });
    expect(CLASSIFY_MESSAGE_TOOL).toBe("classify_message");
    expect(result).toEqual({
      type: "tool_result",
      messageId,
      toolCallId: "t1",
      result: { ok: true, output: { label: "greeting", reason: "Says hello." } },
    });
  });

  it("gives each pair a fresh shared tool call id by default", () => {
    const c = { label: "in_scope", reason: "Airports." } as const;
    const [a1, a2] = classificationToolEvents(messageId, "x", c);
    const [b1] = classificationToolEvents(messageId, "x", c);
    expect(a1.toolCallId).toBe(a2.toolCallId);
    expect(a1.toolCallId).not.toBe(b1.toolCallId);
  });
});
