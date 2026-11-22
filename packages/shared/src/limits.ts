/** Request limits for POST /api/chat. The server enforces them; the client stays inside them. */

/** Most turns a single request's history may contain. */
export const MAX_TURNS = 100;

/** Longest content, in UTF-16 code units (JS `.length`), of any one turn. */
export const MAX_CONTENT_LENGTH = 20_000;

/** Longest `conversationId`; it must also match CONVERSATION_ID_PATTERN (letters, digits, "-" and "_"). */
export const MAX_CONVERSATION_ID_LENGTH = 64;
export const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
