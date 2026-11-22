import { LlmError, type LlmClient, type LlmMessage } from "../../llm/llmClient.ts";
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

export interface ParsedClassification {
  readonly label: ClassificationLabel;
  /** One short sentence. */
  readonly reason: string;
}

export interface Classification extends ParsedClassification {
  /** 2 when the guardrail fired: the first answer was not a valid label and the classifier was asked once more (#19). */
  readonly attempts: 1 | 2;
}

const MAX_REASON_LENGTH = 200;

/** The result used when the classifier's output is still unclear after the #19 retry (not for a failed call, #22). */
export const FALLBACK_CLASSIFICATION: ParsedClassification = {
  label: "in_scope",
  reason: "The classifier could not decide, so the message is treated as in scope.",
};

/** The allow list check (#19): exact match after trim and lowercase. Returns the normalized label. */
const asLabel = (value: unknown): ClassificationLabel | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return CLASSIFICATION_LABELS.find((label) => label === normalized);
};

/**
 * Parses the classifier's reply strictly: one JSON object `{ label, reason }`, optionally
 * wrapped in a single ```json fence. Returns undefined for anything else.
 */
export function parseClassification(raw: string): ParsedClassification | undefined {
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
  const normalized = asLabel(label);
  if (normalized === undefined || typeof reason !== "string" || reason.trim() === "") return undefined;
  return { label: normalized, reason: reason.trim().slice(0, MAX_REASON_LENGTH) };
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

/** Longest part of the previous bad answer quoted back in the retry prompt. */
const MAX_PREVIOUS_ANSWER_CHARS = 500;

/** The retry prompt (#19): the same input, the model's previous raw answer, and a correction naming the allow list. */
export function buildRetryInput(input: string, previousAnswer: string): string {
  return (
    `${input}\n\nYour previous answer was:\n"""\n${truncate(previousAnswer, MAX_PREVIOUS_ANSWER_CHARS)}\n"""\n\n` +
    "Your previous answer was not a valid classification. Reply with JSON only, choosing `label` from exactly: " +
    `${CLASSIFICATION_LABELS.join(", ")}.`
  );
}

/** A failed classifier call (the client threw) is tried at most this many times in total (#22). */
export const MAX_CALL_ATTEMPTS = 3;
/** Waits before the 2nd and the 3rd call (#22): about 0.5 s, then 1 s. */
export const CALL_BACKOFF_MS: readonly number[] = [500, 1000];

export const CLASSIFIER_UNAVAILABLE_MESSAGE = "The classifier is unavailable right now. Please try again.";

/** Waits `ms`, but rejects with the abort reason as soon as the signal aborts. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * One classifier LLM call, returning the reply text. A call failure (the client throws) is retried
 * up to MAX_CALL_ATTEMPTS in total with a backoff; after the last one it throws an LlmError
 * ("unavailable"), never a label (#22). An abort stops at once, also during the backoff.
 */
async function callWithRetry(client: LlmClient, content: string, signal: AbortSignal): Promise<string> {
  for (let call = 1; call <= MAX_CALL_ATTEMPTS; call++) {
    try {
      let text = "";
      const request = {
        system: CLASSIFIER_PROMPT,
        model: MODELS[client.provider].classifier,
        messages: [{ role: "user", content }] as const,
        signal,
      };
      for await (const event of client.stream(request)) {
        signal.throwIfAborted();
        if (event.type === "text_delta") text += event.text;
      }
      return text;
    } catch (err) {
      if (signal.aborted) throw signal.reason;
      // Never log the user's text: only the provider and the error's own message.
      const detail = err instanceof Error ? err.message : "unknown error";
      console.warn(`classify_message: ${client.provider} call ${call}/${MAX_CALL_ATTEMPTS} failed (${detail})`);
      if (call === MAX_CALL_ATTEMPTS) throw new LlmError("unavailable", CLASSIFIER_UNAVAILABLE_MESSAGE);
      await sleep(CALL_BACKOFF_MS[call - 1] ?? 1000, signal);
    }
  }
  throw new LlmError("unavailable", CLASSIFIER_UNAVAILABLE_MESSAGE);
}

/**
 * The first agent step (#13): LLM calls through the selected client that label the user's
 * latest message, using the provider's fast classifier model (#17). Guardrail (#19): if the
 * reply is not valid JSON or its label is not in the allow list, ONE retry call shows the
 * model its previous answer and asks it to choose only from the allow list. Still invalid: falls
 * back to `in_scope`. A failed CALL (the client throws) is a different path (#22): up to 3 calls
 * with a backoff, then it throws LlmError("unavailable"); there is no in_scope fallback for it.
 * An aborted signal cancels the call, the backoff and the retry, and rethrows instead of returning a label.
 */
export async function classifyMessage(
  client: LlmClient,
  messages: readonly LlmMessage[],
  signal: AbortSignal,
): Promise<Classification> {
  signal.throwIfAborted();
  const input = buildClassifierInput(messages);
  let previousAnswer: string | undefined;
  for (const attempts of [1, 2] as const) {
    const content = previousAnswer === undefined ? input : buildRetryInput(input, previousAnswer);
    const text = await callWithRetry(client, content, signal);
    // A client may end its stream quietly on abort (Claude headless does): still cancel.
    signal.throwIfAborted();
    const parsed = parseClassification(text);
    if (parsed !== undefined) return { ...parsed, attempts };
    previousAnswer = text;
  }
  console.warn(`classify_message: ${client.provider} reply was not a valid classification after a retry; using in_scope`);
  return { ...FALLBACK_CLASSIFICATION, attempts: 2 };
}
