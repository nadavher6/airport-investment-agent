import {
  asMessageId,
  asModelId,
  asToolCallId,
  nowIso,
  type AgentEvent,
  type ChatMessage,
  type ModelInfo,
} from "@airport/shared";

export const MSG = asMessageId("assistant-1");
export const TOOL = asToolCallId("tool-1");
export const MODEL_ID = asModelId("gemini-3.5-flash");

export function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: MODEL_ID,
    label: "Gemini 3.5 Flash",
    provider: "gemini",
    description: "Fast default.",
    capabilities: { thinking: true, toolUse: true },
    available: true,
    ...overrides,
  };
}

export function userMessage(text: string, id = "user-1"): ChatMessage {
  return { id: asMessageId(id), role: "user", blocks: [{ type: "text", text }], createdAt: nowIso(), status: "complete" };
}

/** A complete agent run: thinking, one tool round-trip, a two-part answer. */
export const fullRun: AgentEvent[] = [
  { type: "message_start", messageId: MSG, modelId: MODEL_ID },
  { type: "thinking_delta", messageId: MSG, delta: "Let me " },
  { type: "thinking_delta", messageId: MSG, delta: "check." },
  { type: "thinking_end", messageId: MSG, durationMs: 1200 },
  { type: "tool_call", messageId: MSG, toolCallId: TOOL, name: "search_airports", input: { query: "SFO" } },
  { type: "tool_result", messageId: MSG, toolCallId: TOOL, result: { ok: true, output: { count: 1 } } },
  { type: "text_delta", messageId: MSG, delta: "SFO is " },
  { type: "text_delta", messageId: MSG, delta: "congested." },
  { type: "message_end", messageId: MSG, stopReason: "end_turn" },
];
