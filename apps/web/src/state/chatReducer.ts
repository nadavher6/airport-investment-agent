import {
  assertNever,
  nowIso,
  type AgentEvent,
  type ApiError,
  type ChatMessage,
  type ContentBlock,
  type MessageId,
  type MessageStatus,
} from "@airport/shared";

export interface ChatState {
  readonly messages: readonly ChatMessage[];
  readonly isStreaming: boolean;
  /** The most recent failure, shown as a banner until the next send. */
  readonly lastError: ApiError | null;
}

export type ChatAction =
  | { readonly type: "user_sent"; readonly message: ChatMessage }
  | { readonly type: "agent_event"; readonly event: AgentEvent }
  /** The HTTP stream closed. A no-op unless the server never sent message_end or error. */
  | { readonly type: "stream_ended" }
  | { readonly type: "stream_cancelled" }
  | { readonly type: "stream_failed"; readonly error: ApiError }
  | { readonly type: "reset" };

export const initialChatState: ChatState = { messages: [], isStreaming: false, lastError: null };

// --- block helpers ---------------------------------------------------------

/** Append a streamed delta to the trailing block of the same kind, or start a new one. */
function appendDelta(blocks: readonly ContentBlock[], kind: "text" | "thinking", delta: string): ContentBlock[] {
  const last = blocks.at(-1);
  const canExtend = last?.type === kind && (last.type !== "thinking" || last.durationMs === undefined);
  if (canExtend) return [...blocks.slice(0, -1), { ...last, text: last.text + delta }];
  return [...blocks, { type: kind, text: delta }];
}

function finishThinking(blocks: readonly ContentBlock[], durationMs: number): ContentBlock[] {
  return blocks.map((block) =>
    block.type === "thinking" && block.durationMs === undefined ? { ...block, durationMs } : block,
  );
}

function updateMessage(
  state: ChatState,
  id: MessageId,
  update: (message: ChatMessage) => ChatMessage,
): ChatState {
  return { ...state, messages: state.messages.map((m) => (m.id === id ? update(m) : m)) };
}

/**
 * Closes out the in-flight assistant message (if any) with a terminal status.
 * If the request failed before any reply started, the user turn itself is marked
 * "error" so it is shown as unsent and kept out of later history.
 */
function settleStreaming(state: ChatState, status: Exclude<MessageStatus, "streaming">): ChatState {
  const last = state.messages.at(-1);
  const unsentId = state.isStreaming && status === "error" && last?.role === "user" ? last.id : null;
  return {
    ...state,
    isStreaming: false,
    messages: state.messages.map((m) => (m.status === "streaming" || m.id === unsentId ? { ...m, status } : m)),
  };
}

// --- event application -----------------------------------------------------

function applyAgentEvent(state: ChatState, event: AgentEvent): ChatState {
  switch (event.type) {
    case "message_start":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: event.messageId,
            role: "assistant",
            blocks: [],
            createdAt: nowIso(),
            status: "streaming",
            modelId: event.modelId,
          },
        ],
      };

    case "thinking_delta":
      return updateMessage(state, event.messageId, (m) => ({
        ...m,
        blocks: appendDelta(m.blocks, "thinking", event.delta),
      }));

    case "thinking_end":
      return updateMessage(state, event.messageId, (m) => ({
        ...m,
        blocks: finishThinking(m.blocks, event.durationMs),
      }));

    case "text_delta":
      return updateMessage(state, event.messageId, (m) => ({
        ...m,
        blocks: appendDelta(m.blocks, "text", event.delta),
      }));

    case "tool_call":
      return updateMessage(state, event.messageId, (m) => ({
        ...m,
        blocks: [
          ...m.blocks,
          { type: "tool_use", toolCallId: event.toolCallId, name: event.name, input: event.input, status: "running" },
        ],
      }));

    case "tool_result":
      return updateMessage(state, event.messageId, (m) => ({
        ...m,
        blocks: m.blocks.map((block) => {
          if (block.type !== "tool_use" || block.toolCallId !== event.toolCallId) return block;
          return event.result.ok
            ? { ...block, status: "succeeded", output: event.result.output }
            : { ...block, status: "failed", errorMessage: event.result.errorMessage };
        }),
      }));

    case "message_end":
      return {
        ...updateMessage(state, event.messageId, (m) => ({
          ...m,
          status: event.stopReason === "cancelled" ? "cancelled" : "complete",
        })),
        isStreaming: false,
      };

    case "error":
      return { ...settleStreaming(state, "error"), lastError: event.error };

    default:
      // Compile-time exhaustive, but tolerant at runtime: a newer server may send
      // types this bundle doesn't know, and throwing here would unmount the app.
      event satisfies never;
      return state;
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "user_sent":
      return { messages: [...state.messages, action.message], isStreaming: true, lastError: null };
    case "agent_event":
      return applyAgentEvent(state, action.event);
    case "stream_ended":
      return state.isStreaming
        ? {
            ...settleStreaming(state, "error"),
            lastError: { code: "internal", message: "The response ended unexpectedly." },
          }
        : state;
    case "stream_cancelled":
      return settleStreaming(state, "cancelled");
    case "stream_failed":
      return { ...settleStreaming(state, "error"), lastError: action.error };
    case "reset":
      return initialChatState;
    default:
      return assertNever(action, "chat action");
  }
}
