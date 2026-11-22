import type { ApiError } from "./errors.ts";
import type { MessageId, ModelId, ToolCallId } from "./ids.ts";
import type { JsonObject, JsonValue } from "./json.ts";

/**
 * The streaming protocol for POST /api/chat.
 *
 * The server writes these as Server-Sent Events (`data: <json>\n\n`).
 * Every event is a discriminated union member keyed by `type`, so a client
 * `switch (event.type)` is exhaustively checked by the compiler.
 *
 * Typical order:
 *   message_start
 *   (thinking_delta* thinking_end)?
 *   (tool_call tool_result)*
 *   text_delta*
 *   message_end
 * `error` may arrive at any point and ends the stream.
 */

export interface MessageStartEvent {
  readonly type: "message_start";
  readonly messageId: MessageId;
  readonly modelId: ModelId;
}

export interface ThinkingDeltaEvent {
  readonly type: "thinking_delta";
  readonly messageId: MessageId;
  readonly delta: string;
}

export interface ThinkingEndEvent {
  readonly type: "thinking_end";
  readonly messageId: MessageId;
  readonly durationMs: number;
}

export interface ToolCallEvent {
  readonly type: "tool_call";
  readonly messageId: MessageId;
  readonly toolCallId: ToolCallId;
  readonly name: string;
  readonly input: JsonObject;
}

export type ToolResult =
  | { readonly ok: true; readonly output: JsonValue }
  | { readonly ok: false; readonly errorMessage: string };

export interface ToolResultEvent {
  readonly type: "tool_result";
  readonly messageId: MessageId;
  readonly toolCallId: ToolCallId;
  readonly result: ToolResult;
}

export interface TextDeltaEvent {
  readonly type: "text_delta";
  readonly messageId: MessageId;
  readonly delta: string;
}

export type StopReason = "end_turn" | "max_tokens" | "cancelled";

export interface MessageEndEvent {
  readonly type: "message_end";
  readonly messageId: MessageId;
  readonly stopReason: StopReason;
}

export interface ErrorEvent {
  readonly type: "error";
  readonly error: ApiError;
}

export type AgentEvent =
  | MessageStartEvent
  | ThinkingDeltaEvent
  | ThinkingEndEvent
  | ToolCallEvent
  | ToolResultEvent
  | TextDeltaEvent
  | MessageEndEvent
  | ErrorEvent;

export type AgentEventType = AgentEvent["type"];

/** Look up one event shape by its tag: `AgentEventOf<"tool_call">`. */
export type AgentEventOf<T extends AgentEventType> = Extract<AgentEvent, { type: T }>;
