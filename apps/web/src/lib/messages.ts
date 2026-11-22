import type { ChatMessage, ChatTurn } from "@airport/shared";

/** The visible answer text of a message (thinking and tool blocks excluded). */
export function messageText(message: ChatMessage): string {
  return message.blocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

/** Flattens UI messages into the wire history. Empty turns (e.g. failed replies) are dropped. */
export function toChatTurns(messages: readonly ChatMessage[]): ChatTurn[] {
  return messages
    .map((message) => ({ role: message.role, content: messageText(message) }))
    .filter((turn) => turn.content !== "");
}
