import { useCallback, useEffect, useReducer, useRef } from "react";
import { asMessageId, nowIso, type ChatMessage, type ModelId } from "@airport/shared";
import { api, ApiClientError } from "../api/client";
import { toChatTurns } from "../lib/messages";
import { chatReducer, initialChatState } from "../state/chatReducer";

export function useChat(modelId: ModelId | null) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const abortRef = useRef<AbortController | null>(null);

  // Keep the latest messages in a ref so send() can build history without being recreated per token.
  const messagesRef = useRef(state.messages);
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || !modelId || abortRef.current) return;

      const userMessage: ChatMessage = {
        id: asMessageId(crypto.randomUUID()),
        role: "user",
        blocks: [{ type: "text", text: content }],
        createdAt: nowIso(),
        status: "complete",
      };
      dispatch({ type: "user_sent", message: userMessage });

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const request = { modelId, messages: toChatTurns([...messagesRef.current, userMessage]) };
        for await (const event of api.streamChat(request, controller.signal)) {
          dispatch({ type: "agent_event", event });
        }
        dispatch({ type: "stream_ended" });
      } catch (err) {
        if (controller.signal.aborted) {
          dispatch({ type: "stream_cancelled" });
        } else if (err instanceof ApiClientError) {
          dispatch({ type: "stream_failed", error: err.apiError });
        } else {
          dispatch({ type: "stream_failed", error: { code: "internal", message: "Couldn't reach the agent. Is the server running?" } });
        }
      } finally {
        abortRef.current = null;
      }
    },
    [modelId],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { ...state, send, stop, reset };
}
