import { randomUUID } from "node:crypto";
import { asToolCallId, type JsonObject, type JsonValue, type MessageId, type ToolCallEvent, type ToolResultEvent } from "@airport/shared";
import { toWireResult, type RegisteredTool, type ToolRunResult } from "../tools/tool.ts";

/** One server-run tool step, with the tool_call/tool_result pair that shows it in the chat. */
export interface ToolStep {
  readonly events: readonly [ToolCallEvent, ToolResultEvent];
  readonly result: ToolRunResult<JsonValue>;
}

/**
 * Runs a registered tool (it validates its input and never throws) and builds its event pair.
 * An abort during the run stops the flow: it rethrows instead of returning a result.
 */
export async function runToolStep(tool: RegisteredTool, input: JsonObject, messageId: MessageId, signal: AbortSignal): Promise<ToolStep> {
  signal.throwIfAborted();
  const toolCallId = asToolCallId(randomUUID());
  const result = await tool.run(input, { signal });
  signal.throwIfAborted();
  return {
    events: [
      { type: "tool_call", messageId, toolCallId, name: tool.name, input },
      { type: "tool_result", messageId, toolCallId, result: toWireResult(result) },
    ],
    result,
  };
}
