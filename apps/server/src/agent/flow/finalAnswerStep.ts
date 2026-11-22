import {
  UNFORMATTED_NOTE,
  fallbackText,
  logFinalAnswerIssue,
  parseFinalAnswer,
  renderAnswer,
  renderFinalAnswerFeedback,
} from "../finalAnswer.ts";
import { scanReply } from "../finalAnswerScan.ts";
import type { ModelStep } from "../toolCall.ts";
import { GRACEFUL_FALLBACK, MAX_INVALID_RETRIES } from "../toolGuard.ts";

/** What the loop does with a final-answer step (#63). */
export type FinalStep =
  /** Invalid, nothing shown yet, retries left: feed `feedback` back after the model's `reply`. */
  | { readonly kind: "retry"; readonly reply: string; readonly feedback: string }
  /** The turn ends: show `rest` (after what was already streamed), or the plain `fallback` sentence. */
  | { readonly kind: "done"; readonly rest: string; readonly fallback?: string };

/**
 * Is this step a final answer (not a tool call)? A reply whose first JSON object has a `kind` or `answer` key
 * is one (even if its markdown quotes a tool call); so is prose (#49's parser finds no call attempt; an invalid
 * final answer). Otherwise it is a tool step, except broken JSON with a `kind`/`answer` key and no `tool` key.
 */
export function isFinalAnswerStep(text: string, parsed: ModelStep): boolean {
  const keys = scanReply(text).topKeys;
  if (keys.includes("kind") || keys.includes("answer")) return true;
  if (parsed.kind === "answer") return true;
  if (keys.includes("tool")) return false;
  // Broken JSON the scanner could not follow (e.g. unquoted keys): by its key names.
  return FINAL_KEY.test(text) && !TOOL_KEY.test(text);
}

const FINAL_KEY = /[{,]\s*["']?(?:kind|answer)["']?\s*:/;
const TOOL_KEY = /[{,]\s*["']?tool["']?\s*:/;

/**
 * The final-answer guardrail for one step (#63). Null when the step is a tool call (the loop's #49 path).
 * `emitted` is what FinalAnswerStream already showed live; `invalidSoFar` counts earlier invalid final answers
 * this turn. A valid answer: the rest of `renderAnswer`. Invalid with nothing shown: a retry while the budget
 * lasts (MAX_INVALID_RETRIES), then the fallback: the reply as Markdown (never raw JSON) plus the
 * "unformatted" note, or `plain` when nothing safe is left. Invalid after text was shown live (a "late"
 * failure, e.g. a cut-off reply): no retry, so the answer is never shown twice; the note is added.
 */
export function finalAnswerStep(
  text: string,
  emitted: string,
  parsed: ModelStep,
  invalidSoFar: number,
  knownAirport?: (code: string) => boolean,
  plain: string = GRACEFUL_FALLBACK,
): FinalStep | null {
  if (!isFinalAnswerStep(text, parsed)) return null;
  const result = parseFinalAnswer(text, knownAirport);
  if (result.ok) {
    const rendered = renderAnswer(result.answer);
    return { kind: "done", rest: rendered.startsWith(emitted) ? rendered.slice(emitted.length) : "" };
  }
  const { code } = result.error;
  if (emitted !== "") {
    logFinalAnswerIssue("late_invalid", code, text.length);
    return { kind: "done", rest: `\n\n${UNFORMATTED_NOTE}` };
  }
  logFinalAnswerIssue("invalid", code, text.length);
  if (invalidSoFar < MAX_INVALID_RETRIES) return { kind: "retry", reply: text, feedback: renderFinalAnswerFeedback(result.error, text) };
  const shown = fallbackText(text);
  logFinalAnswerIssue("fallback", code, text.length);
  return shown === null ? { kind: "done", rest: "", fallback: plain } : { kind: "done", rest: `${shown}\n\n${UNFORMATTED_NOTE}` };
}
