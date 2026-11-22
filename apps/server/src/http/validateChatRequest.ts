import { asModelId, type ChatRequest, type ChatTurn, type Role } from "@airport/shared";
import { HttpError } from "./errors.ts";

const ROLES: readonly Role[] = ["user", "assistant"];
const MAX_TURNS = 100;
const MAX_CONTENT_LENGTH = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isRole = (value: unknown): value is Role => ROLES.some((role) => role === value);

function parseTurn(value: unknown, index: number): ChatTurn {
  if (!isRecord(value)) throw new HttpError("bad_request", `messages[${index}] must be an object`);
  const { role, content } = value;
  if (!isRole(role)) {
    throw new HttpError("bad_request", `messages[${index}].role must be "user" or "assistant"`);
  }
  if (typeof content !== "string") {
    throw new HttpError("bad_request", `messages[${index}].content must be a string`);
  }
  // An assistant reply cancelled or failed before any text flattens to "", which is legitimate history.
  if (role === "user" && content.trim() === "") {
    throw new HttpError("bad_request", `messages[${index}].content must be a non-empty string`);
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new HttpError("bad_request", `messages[${index}].content exceeds ${MAX_CONTENT_LENGTH} characters`);
  }
  return { role, content };
}

/** Narrows an untrusted JSON body to a ChatRequest, or throws a 400. */
export function validateChatRequest(body: unknown): ChatRequest {
  if (!isRecord(body)) throw new HttpError("bad_request", "Body must be a JSON object");
  const { modelId, messages } = body;

  if (typeof modelId !== "string" || modelId === "") {
    throw new HttpError("bad_request", "modelId must be a non-empty string");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError("bad_request", "messages must be a non-empty array");
  }
  if (messages.length > MAX_TURNS) {
    throw new HttpError("bad_request", `messages may contain at most ${MAX_TURNS} turns`);
  }

  const turns = messages.map(parseTurn);
  if (turns.at(-1)?.role !== "user") {
    throw new HttpError("bad_request", "The last message must have role \"user\"");
  }
  return { modelId: asModelId(modelId), messages: turns };
}
