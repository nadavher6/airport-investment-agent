import type { AgentEvent, ChatMessage } from "@airport/shared";
import { describe, expect, it } from "vitest";
// Cross-workspace on purpose: the web builds the history, this server must accept it.
import { toChatTurns } from "../../../web/src/lib/messages.ts";
import { chatReducer, initialChatState, type ChatAction } from "../../../web/src/state/chatReducer.ts";
import { fullRun, MODEL_ID, MSG, userMessage } from "../../../web/src/test/fixtures.ts";
import { validateChatRequest } from "./validateChatRequest.ts";

const start: AgentEvent = { type: "message_start", messageId: MSG, modelId: MODEL_ID };
const event = (e: AgentEvent): ChatAction => ({ type: "agent_event", event: e });

/** Plays UI actions through the real reducer, then sends a follow-up like the Composer does. */
function historyAfter(actions: ChatAction[]): ChatMessage[] {
  const all: ChatAction[] = [{ type: "user_sent", message: userMessage("Rank airports") }, ...actions];
  const state = all.reduce(chatReducer, initialChatState);
  return [...state.messages, userMessage("Continue", "user-2")];
}

const histories: Record<string, ChatAction[]> = {
  "a complete reply": [...fullRun.map(event), { type: "stream_ended" }],
  "Stop with partial text": [event(start), event({ type: "text_delta", messageId: MSG, delta: "SFO is" }), { type: "stream_cancelled" }],
  "Stop during thinking, before any text": [
    event(start),
    event({ type: "thinking_delta", messageId: MSG, delta: "Let me check" }),
    { type: "stream_cancelled" },
  ],
  "Stop during a tool call": [event(start), event(fullRun[4]!), { type: "stream_cancelled" }],
  "an error event mid-reply": [
    event(start),
    event({ type: "thinking_delta", messageId: MSG, delta: "hmm" }),
    event({ type: "error", error: { code: "internal", message: "boom" } }),
  ],
  "a request that failed before the stream opened": [
    { type: "stream_failed", error: { code: "model_unavailable", message: "No key" } },
  ],
  "a stream that ended without message_end": [event(start), event({ type: "text_delta", messageId: MSG, delta: "Hal" }), { type: "stream_ended" }],
};

describe("web history -> server validator contract", () => {
  it.each(Object.entries(histories))("the server accepts the history after %s", (_name, actions) => {
    const messages = toChatTurns(historyAfter(actions));
    expect(() => validateChatRequest({ modelId: MODEL_ID, messages })).not.toThrow();
  });
});
