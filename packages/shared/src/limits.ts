/** Request limits for POST /api/chat. The server enforces them; the client stays inside them. */

/** Most turns a single request's history may contain. */
export const MAX_TURNS = 100;

/** Longest content, in UTF-16 code units (JS `.length`), of any one turn. */
export const MAX_CONTENT_LENGTH = 20_000;
