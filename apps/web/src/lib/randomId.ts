/**
 * A random id that works in any context. `crypto.randomUUID` exists only in a secure context (https or localhost);
 * over plain http on a LAN IP it is missing, so fall back to a UUID v4 built from `crypto.getRandomValues`.
 * The result is 36 characters of hex and "-", which passes the server's conversationId rule.
 */
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
