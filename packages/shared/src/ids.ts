/**
 * Branded string IDs. They're plain strings at runtime, but the compiler
 * won't let a MessageId be passed where a ToolCallId is expected.
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MessageId = Brand<string, "MessageId">;
export type ToolCallId = Brand<string, "ToolCallId">;
export type ModelId = Brand<string, "ModelId">;
/** One chat in the web app (#50): minted by the client per conversation, used only to key server-side memory. */
export type ConversationId = Brand<string, "ConversationId">;

/** The only sanctioned way to mint IDs: at trust boundaries (server, or parsed input). */
export const asMessageId = (value: string) => value as MessageId;
export const asToolCallId = (value: string) => value as ToolCallId;
export const asModelId = (value: string) => value as ModelId;
export const asConversationId = (value: string) => value as ConversationId;

/** ISO-8601 timestamp string, e.g. "2026-11-22T10:18:00.000Z". */
export type IsoDateString = Brand<string, "IsoDateString">;
export const nowIso = () => new Date().toISOString() as IsoDateString;
