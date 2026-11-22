import type { IsoDateString, MessageId, ModelId, ToolCallId } from "./ids.ts";
import type { JsonObject, JsonValue } from "./json.ts";

export type Role = "user" | "assistant";

// ---------------------------------------------------------------------------
// Content blocks: an assistant message is an ordered list of these, so the UI
// can render "thinking -> tool call -> more thinking -> answer" in order.
// ---------------------------------------------------------------------------

export interface TextBlock {
  readonly type: "text";
  readonly text: string;
}

export interface ThinkingBlock {
  readonly type: "thinking";
  readonly text: string;
  /** Set once thinking finishes; undefined means it is still in progress. */
  readonly durationMs?: number;
}

export type ToolCallStatus = "running" | "succeeded" | "failed";

export interface ToolUseBlock {
  readonly type: "tool_use";
  readonly toolCallId: ToolCallId;
  readonly name: string;
  readonly input: JsonObject;
  readonly status: ToolCallStatus;
  readonly output?: JsonValue;
  readonly errorMessage?: string;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock;
export type ContentBlockType = ContentBlock["type"];

export type MessageStatus = "streaming" | "complete" | "error" | "cancelled";

export interface ChatMessage {
  readonly id: MessageId;
  readonly role: Role;
  readonly blocks: readonly ContentBlock[];
  readonly createdAt: IsoDateString;
  readonly status: MessageStatus;
  /** Which model produced this message (assistant only). */
  readonly modelId?: ModelId;
}

/**
 * The flattened form of a past message sent back to the server as history.
 * Only the text matters for context, so we don't send thinking or tool blocks.
 */
export interface ChatTurn {
  readonly role: Role;
  readonly content: string;
}
