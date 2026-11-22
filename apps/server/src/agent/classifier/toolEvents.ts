import { randomUUID } from "node:crypto";
import { asToolCallId, type MessageId, type ToolCallEvent, type ToolResultEvent } from "@airport/shared";
import type { Classification } from "./classifier.ts";

/** The tool name the classifier step is shown under in the chat. */
export const CLASSIFY_MESSAGE_TOOL = "classify_message";

/**
 * Shows a classification in the chat as a step, reusing the existing tool_call/tool_result
 * events (no contract change). `message` is the user message that was classified.
 */
export function classificationToolEvents(
  messageId: MessageId,
  message: string,
  classification: Classification,
  toolCallId = asToolCallId(randomUUID()),
): readonly [ToolCallEvent, ToolResultEvent] {
  return [
    { type: "tool_call", messageId, toolCallId, name: CLASSIFY_MESSAGE_TOOL, input: { message } },
    {
      type: "tool_result",
      messageId,
      toolCallId,
      result: { ok: true, output: { label: classification.label, reason: classification.reason } },
    },
  ];
}
