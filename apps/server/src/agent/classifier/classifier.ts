import { type LlmClient, type LlmMessage } from "../../llm/llmClient.ts";
import { MODELS } from "../../llm/models.ts";
import {
  CLASSIFIER_LAST_MESSAGE_HEAD_CHARS,
  CLASSIFIER_LAST_MESSAGE_TAIL_CHARS,
  CLASSIFIER_PROMPT,
  CLASSIFIER_RECENT_TURNS,
  CLASSIFIER_TURN_CHARS,
} from "./prompt.ts";

export const CLASSIFICATION_LABELS = ["greeting", "capabilities", "off_topic", "in_scope"] as const;
export type ClassificationLabel = (typeof CLASSIFICATION_LABELS)[number];

export interface Classification {
  readonly label: ClassificationLabel;
  /** One short sentence. */
  readonly reason: string;
}

const MAX_REASON_LENGTH = 200;

/** The result used whenever the classifier's output is unclear or the call fails. */
export const FALLBACK_CLASSIFICATION: Classification = {
  label: "in_scope",
  reason: "The classifier could not decide, so the message is treated as in scope.",
};

const isLabel = (value: unknown): value is ClassificationLabel =>
  typeof value === "string" && (CLASSIFICATION_LABELS as readonly string[]).includes(value);

/**
 * Parses the classifier's reply strictly: one JSON object `{ label, reason }`, optionally
 * wrapped in a single ```json fence. Returns undefined for anything else.
 */
export function parseClassification(raw: string): Classification | undefined {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(raw.trim());
  const body = (fenced?.[1] ?? raw).trim();
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { label, reason } = value as Record<string, unknown>;
  if (!isLabel(label) || typeof reason !== "string" || reason.trim() === "") return undefined;
  return { label, reason: reason.trim().slice(0, MAX_REASON_LENGTH) };
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}...` : text);

/** Keeps the start and the end of a long message, with a marker for what was left out. */
function truncateHeadTail(text: string, head: number, tail: number): string {
  if (text.length <= head + tail) return text;
  const omitted = text.length - head - tail;
  return `${text.slice(0, head)}\n[... ${omitted} characters omitted ...]\n${text.slice(text.length - tail)}`;
}

/** Renders the last few turns as one transcript, so the model labels rather than answers it. */
export function buildClassifierInput(messages: readonly LlmMessage[]): string {
  const recent = messages.slice(-CLASSIFIER_RECENT_TURNS);
  const transcript = recent
    .map((m, i) => {
      const isLast = i === recent.length - 1;
      const text = isLast
        ? truncateHeadTail(m.content, CLASSIFIER_LAST_MESSAGE_HEAD_CHARS, CLASSIFIER_LAST_MESSAGE_TAIL_CHARS)
        : truncate(m.content, CLASSIFIER_TURN_CHARS);
      return `[${m.role}]\n${text}`;
    })
    .join("\n\n");
  return `Transcript (oldest first):\n\n${transcript}\n\nClassify the last user message. Reply with JSON only.`;
}

/**
 * The first agent step (#13): one LLM call through the selected client that labels the
 * user's latest message. Falls back to `in_scope` on unclear output or any error; an
 * aborted signal cancels the call and rethrows instead of returning a label.
 */
export async function classifyMessage(
  client: LlmClient,
  messages: readonly LlmMessage[],
  signal: AbortSignal,
): Promise<Classification> {
  signal.throwIfAborted();
  let text = "";
  try {
    const request = {
      system: CLASSIFIER_PROMPT,
      model: MODELS[client.provider].classifier,
      messages: [{ role: "user", content: buildClassifierInput(messages) }] as const,
      signal,
    };
    for await (const event of client.stream(request)) {
      signal.throwIfAborted();
      if (event.type === "text_delta") text += event.text;
    }
  } catch (err) {
    if (signal.aborted) throw signal.reason;
    // Never log the user's text: only the provider and the error's own message.
    const detail = err instanceof Error ? err.message : "unknown error";
    console.warn(`classify_message: ${client.provider} call failed (${detail}); using in_scope`);
    return FALLBACK_CLASSIFICATION;
  }
  // A client may end its stream quietly on abort (Claude headless does): still cancel.
  signal.throwIfAborted();
  const parsed = parseClassification(text);
  if (parsed === undefined) {
    console.warn(`classify_message: ${client.provider} reply was not a valid classification; using in_scope`);
    return FALLBACK_CLASSIFICATION;
  }
  return parsed;
}
