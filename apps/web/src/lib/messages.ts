import { MAX_CONTENT_LENGTH, MAX_TURNS, type ChatMessage, type ChatTurn } from "@airport/shared";

/** The visible answer text of a message (thinking and tool blocks excluded). */
export function messageText(message: ChatMessage): string {
  return message.blocks
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

/** A user turn whose request failed before any reply. It stays on screen but never re-enters history. */
export function isUnsent(message: ChatMessage): boolean {
  return message.role === "user" && message.status === "error";
}

/**
 * Flattens UI messages into the wire history, kept inside the server's limits so
 * one bad turn or a long thread can't make every later request fail.
 * Unsent user turns and empty turns (e.g. failed replies) are dropped.
 */
export function toChatTurns(messages: readonly ChatMessage[]): ChatTurn[] {
  const turns = messages
    .filter((message) => !isUnsent(message))
    // Only assistant text can exceed the limit (the composer caps user input); a cut answer is still useful context.
    .map((message) => ({ role: message.role, content: messageText(message).slice(0, MAX_CONTENT_LENGTH) }))
    .filter((turn) => turn.content !== "");

  // Keep the newest turns, opening on a user turn so the window doesn't start mid-exchange.
  const recent = turns.slice(-MAX_TURNS);
  const start = recent.findIndex((turn) => turn.role === "user");
  return start <= 0 ? recent : recent.slice(start);
}
