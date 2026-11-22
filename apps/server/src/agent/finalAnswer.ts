import { z } from "zod";
import { getAirportByCode } from "../data/places/airports.ts";
import { capEcho, echo } from "./toolGuard.ts";
import { repairRawControls, scanReply } from "./finalAnswerScan.ts";

/**
 * The final-answer guardrail (#63). The model's final reply in the tool loop must be exactly one JSON object
 * `{ "kind": "final_answer", "answer": { summary, markdown, airports?, caveats? } }`, validated strictly here.
 * An invalid reply is a typed FinalAnswerError, fed back to the model in a delimited FINAL_ANSWER_ERROR
 * block (same echo rules as #49's TOOL_CALL_ERROR) and retried; after the retries the loop shows a safe
 * fallback. Nothing here throws. The user only ever sees `renderAnswer` (or the fallback), never the JSON.
 */

export const MAX_SUMMARY_CHARS = 400;
export const MAX_MARKDOWN_CHARS = 12_000;
export const MAX_CAVEATS = 6;
export const MAX_CAVEAT_CHARS = 200;
export const MAX_ANSWER_AIRPORTS = 20;

const nonBlank = (s: string): boolean => s.trim() !== "";

export const AnswerSchema = z
  .object({
    summary: z.string().max(MAX_SUMMARY_CHARS).refine(nonBlank, "must not be empty"),
    markdown: z.string().max(MAX_MARKDOWN_CHARS).refine(nonBlank, "must not be empty"),
    airports: z
      .array(z.string().regex(/^[A-Za-z0-9]{3,4}$/, "must be a 3- or 4-letter airport code"))
      .max(MAX_ANSWER_AIRPORTS)
      .optional(),
    caveats: z.array(z.string().max(MAX_CAVEAT_CHARS).refine(nonBlank, "must not be empty")).max(MAX_CAVEATS).optional(),
  })
  .strict();

export const FinalAnswerSchema = z.object({ kind: z.literal("final_answer"), answer: AnswerSchema }).strict();

export type FinalAnswer = z.infer<typeof AnswerSchema>;

/** The expected format as JSON Schema, for the feedback block. */
export const FINAL_ANSWER_JSON_SCHEMA: string = JSON.stringify(z.toJSONSchema(FinalAnswerSchema));

export type FinalAnswerErrorCode =
  /** Prose (or nothing) instead of the JSON object. */
  | "not_json"
  /** A JSON object, but with text before or after it. */
  | "extra_text"
  /** The JSON does not parse, or never closes. */
  | "invalid_json"
  /** Not the expected shape: a missing or extra key, a wrong type, an empty field. */
  | "bad_shape"
  /** `kind` is not exactly "final_answer". */
  | "wrong_kind"
  /** A field over its limit (summary, markdown, caveats, airports). */
  | "over_limit"
  /** An `airports` code that is not in the airport data. */
  | "unknown_airport";

export interface FinalAnswerError {
  readonly code: FinalAnswerErrorCode;
  readonly problem: string;
}

export type FinalAnswerResult = { readonly ok: true; readonly answer: FinalAnswer } | { readonly ok: false; readonly error: FinalAnswerError };

/** Does this code exist in the airport data (the get_airport_by_code lookup)? */
export const isKnownAirport = (code: string): boolean => !("error" in getAirportByCode(code));

const fail = (code: FinalAnswerErrorCode, problem: string): FinalAnswerResult => ({ ok: false, error: { code, problem } });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A whole ``` fence around the reply (optional language tag): its inside, else the reply itself. */
function unfence(text: string): string {
  const fenced = /^```[\w-]*[ \t]*\r?\n([\s\S]*?)\r?\n?[ \t]*```$/.exec(text);
  return fenced?.[1]?.trim() ?? text;
}

/**
 * Validate one model reply as the final answer. Strict: exactly one JSON object (a ``` fence around it is
 * tolerated), no extra keys, kind "final_answer", the limits above, every airport code known.
 */
export function parseFinalAnswer(text: string, knownAirport: (code: string) => boolean = isKnownAirport): FinalAnswerResult {
  const trimmed = text.trim();
  if (trimmed === "") return fail("not_json", "the reply is empty");
  const body = unfence(trimmed);
  if (!body.startsWith("{")) {
    return body.includes("{")
      ? fail("extra_text", "there is text before the JSON object; reply with the JSON object only")
      : fail("not_json", "the reply is prose, not the final-answer JSON object");
  }
  const end = objectEnd(body);
  if (end === -1) return fail("invalid_json", "the JSON object never closes");
  if (body.slice(end).trim() !== "") return fail("extra_text", "there is text after the JSON object; reply with the JSON object only");
  const src = body.slice(0, end);
  let value: unknown;
  try {
    value = JSON.parse(src);
  } catch {
    try {
      value = JSON.parse(repairRawControls(src));
    } catch {
      return fail("invalid_json", "the reply is not valid JSON (keys and strings need double quotes)");
    }
  }
  if (!isPlainObject(value)) return fail("bad_shape", "expected one JSON object");
  if (!("kind" in value)) return fail("bad_shape", 'missing key "kind"');
  if (value.kind !== "final_answer") return fail("wrong_kind", `"kind" must be exactly "final_answer", got ${capEcho(JSON.stringify(value.kind) ?? "?")}`);
  const parsed = FinalAnswerSchema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue && issue.path.length > 0 ? issue.path.join(".") : "(root)";
    const problem = `${field} — ${issue?.message ?? "failed validation"}`;
    return fail(issue?.code === "too_big" ? "over_limit" : "bad_shape", problem);
  }
  const answer = parsed.data.answer;
  const airports = answer.airports?.map((code) => code.toUpperCase());
  const unknown = (airports ?? []).filter((code) => !knownAirport(code));
  if (unknown.length > 0) {
    return fail("unknown_airport", `answer.airports — not in the airport data: ${unknown.join(", ")}; use get_airport_by_code to confirm codes`);
  }
  return { ok: true, answer: airports === undefined ? answer : { ...answer, airports } };
}

/** The end (exclusive) of the balanced object starting at 0, string-aware; -1 when it never closes. */
function objectEnd(src: string): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// What the user sees.
// ---------------------------------------------------------------------------

/** The summary as the bold lead line: one line, `*` escaped so the bold cannot break. */
export function summaryLine(summary: string): string {
  return `**${summary.trim().replace(/\s+/g, " ").replace(/\*/g, "\\*")}**`;
}

/** The separator between the summary line and the markdown body. */
export const SUMMARY_SEPARATOR = "\n\n";

/** A ```caveats fence: one caveat per line, drawn by the web app as a small muted list. */
function caveatsFence(caveats: readonly string[]): string {
  const lines = caveats.map((c) => `- ${c.trim().replace(/\s+/g, " ").replace(/`{3,}/g, "``")}`);
  return `\n\n\`\`\`caveats\n${lines.join("\n")}\n\`\`\``;
}

/**
 * The Markdown the user sees for a valid answer: the summary in bold, the markdown body as written, then
 * the caveats fence. The streamed text is always a prefix of this (finalAnswerStream.ts).
 */
export function renderAnswer(answer: FinalAnswer): string {
  const caveats = answer.caveats !== undefined && answer.caveats.length > 0 ? caveatsFence(answer.caveats) : "";
  return `${summaryLine(answer.summary)}${SUMMARY_SEPARATOR}${answer.markdown}${caveats}`;
}

/** Shown under a fallback answer: the reply could not be checked against the format. */
export const UNFORMATTED_NOTE = "_Unformatted answer: this reply did not come back in the expected answer format._";

/** Keys that mark a reply as JSON the user must not see. */
const JSONISH = /"(?:kind|answer|summary|markdown|airports|caveats|tool|input)"\s*:|^\s*[{[]/;

/** Does this text look like JSON (a final answer or a tool call) rather than prose? */
export const looksLikeJson = (text: string): boolean => JSONISH.test(text);

/**
 * The fallback after the retries (#63): the model's last reply as Markdown, never raw JSON.
 * A JSON-ish reply gives the summary/markdown it holds (decoded, even if cut off); prose is shown as is.
 * Null when there is nothing safe to show (the caller then uses its plain sentence). The note is added by
 * the caller.
 */
export function fallbackText(text: string): string | null {
  if (!looksLikeJson(text)) return text.trim() === "" ? null : text.trim();
  const { summary, markdown } = scanReply(unfence(text.trim())).decoded;
  const parts = [summary.trim() === "" ? "" : summaryLine(summary), markdown.trim()].filter((p) => p !== "");
  const shown = parts.join(SUMMARY_SEPARATOR);
  return shown === "" || looksLikeJson(shown) ? null : shown;
}

/**
 * The FINAL_ANSWER_ERROR block the model gets after an invalid final answer. Runtime data, delimited; every
 * model-controlled value goes through `echo` (capped, one JSON string on its line), like TOOL_CALL_ERROR.
 */
export function renderFinalAnswerFeedback(error: FinalAnswerError, previousReply: string): string {
  return [
    "FINAL_ANSWER_ERROR",
    `code: ${error.code}`,
    `problem: ${echo(error.problem)}`,
    `expected final answer (JSON Schema): ${FINAL_ANSWER_JSON_SCHEMA}`,
    `your previous reply: ${echo(previousReply)}`,
    "Reply with ONLY the corrected final-answer JSON object, nothing before or after it, or call a tool if you still need data.",
    "END_FINAL_ANSWER_ERROR",
  ].join("\n");
}

/** One log line for a final-answer problem: the code and sizes only, never user or model text. */
export function logFinalAnswerIssue(event: "invalid" | "late_invalid" | "fallback", code: FinalAnswerErrorCode | "none", chars: number): void {
  console.warn(JSON.stringify({ event: `final_answer_${event}`, code, chars }));
}
