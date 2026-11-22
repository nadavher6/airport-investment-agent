import type { JsonObject } from "@airport/shared";
import type { ToolError } from "./tools/tool.ts";

/**
 * Tool-call parsing for the ReAct loop (#48, guardrails #49). The LlmClient has no native function
 * calling, so the model writes a call as JSON in its text: `{"tool": "<name>", "input": {...}}`, bare,
 * in a ```json fence, or after a short lead-in. This module decides whether a model step is a tool
 * call and, if it is, either parses it or returns a typed `ToolCallError`. Nothing here throws.
 * Whether the name is an allowed tool is the guard's check (toolGuard.ts), not the parser's.
 */

/** A well-formed tool-use directive from the model's text (the name is not checked here). */
export interface ParsedToolCall {
  readonly name: string;
  readonly input: JsonObject;
}

/** Every way a tool call can go wrong. Each one is fed back to the model, never thrown. */
export type ToolCallErrorCode = ToolCallError["code"];

export type ToolCallError =
  /** It looks like a tool call, but the JSON does not parse. `raw` is the model's text (truncated). */
  | { readonly code: "unparseable"; readonly problem: string; readonly raw: string }
  /** It parses, but is not `{ "tool": string, "input": object }`. `tool` is set when it was a string. */
  | { readonly code: "bad_shape"; readonly problem: string; readonly raw: string; readonly tool?: string }
  /** `tool` is not in the loop's allowed list. */
  | { readonly code: "unknown_tool"; readonly call: ParsedToolCall }
  /** The tool's Zod schema (or a loop rule) rejected `input`. `problem` is `<path> — <message>`. */
  | { readonly code: "invalid_input"; readonly call: ParsedToolCall; readonly problem: string }
  /** The tool ran and returned a `ToolError` (`not_found` / `unavailable` / `internal`). */
  | { readonly code: "tool_failed"; readonly call: ParsedToolCall; readonly error: ToolError }
  /** The exact same tool + input as an earlier call in this turn. */
  | { readonly code: "repeat_call"; readonly call: ParsedToolCall };

/** What one model step turned out to be. `extra`: the step held more than one call (only the first runs). */
export type ModelStep =
  | { readonly kind: "answer" }
  | { readonly kind: "call"; readonly call: ParsedToolCall; readonly extra: boolean }
  | { readonly kind: "error"; readonly error: ToolCallError };

/** The longest slice of the model's own text kept in an error (the feedback caps it again, toolGuard.ts). */
const MAX_RAW_CHARS = 600;
/** At most this many `{` positions are examined per step, so a reply full of braces stays cheap. */
const MAX_CANDIDATES = 256;

/** One `{...}` object found in the text: where it starts, its source, whether it closed, its top-level keys. */
interface Candidate {
  readonly start: number;
  readonly src: string;
  readonly closed: boolean;
  readonly keys: readonly string[];
  readonly fenced: boolean;
}

/** From `start` (a '{'), the end (exclusive) of the balanced object, string-aware; -1 when it never closes. */
function objectEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** A key right after `{` or `,`: `"key"`, `'key'` or a bare identifier, then `:` (read loosely, JSON5-ish). */
const KEY_AT = /\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_$][\w$]*))\s*:/y;
/** A ``` fence opening (with an optional language tag) right before an object. */
const FENCE_BEFORE = /```[\w-]*[ \t]*\r?\n?[ \t]*$/;

/** The top-level keys of an object source, quoted or not, in any order (nested keys and strings are skipped). */
function topLevelKeys(src: string): string[] {
  const keys: string[] = [];
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
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
    if (depth === 1 && (ch === "{" || ch === ",")) {
      KEY_AT.lastIndex = i + 1;
      const match = KEY_AT.exec(src);
      if (match) {
        keys.push(match[1] ?? match[2] ?? match[3] ?? "");
        i = KEY_AT.lastIndex - 1;
      }
    }
  }
  return keys;
}

/** Every `{` in the text (up to MAX_CANDIDATES), nested ones included, as a candidate object. */
function candidates(text: string): Candidate[] {
  const found: Candidate[] = [];
  let start = text.indexOf("{");
  while (start !== -1 && found.length < MAX_CANDIDATES) {
    const end = objectEnd(text, start);
    const src = end === -1 ? text.slice(start) : text.slice(start, end);
    const fenced = FENCE_BEFORE.test(text.slice(Math.max(0, start - 40), start));
    found.push({ start, src, closed: end !== -1, keys: topLevelKeys(src), fenced });
    start = text.indexOf("{", start + 1);
  }
  return found;
}

/**
 * The rule for "this object is an attempted tool call" (anything else is prose, even when it
 * mentions `{"tool": ...}`):
 * 1. the step starts with it (after whitespace): the issue's "a `{` means a call attempt";
 * 2. it has both top-level keys `tool` and `input`, in any order, quoted or not, anywhere in the step
 *    (after a lead-in, in a fence, before trailing prose);
 * 3. it has a top-level `tool` key and sits right inside a ``` fence, or never closes (a cut-off call).
 */
function isAttempt(c: Candidate, text: string): boolean {
  if (c.start === text.length - text.trimStart().length) return true;
  if (!c.keys.includes("tool")) return false;
  return c.keys.includes("input") || c.fenced || !c.closed;
}

/** Does this step hold an attempted tool call (see `isAttempt` for the rule)? */
export function looksLikeToolCall(text: string): boolean {
  return candidates(text).some((c) => isAttempt(c, text));
}

const isPlainObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const truncate = (text: string): string =>
  text.length > MAX_RAW_CHARS ? `${text.slice(0, MAX_RAW_CHARS)}…` : text;

/** The first shape problem of a parsed value, or null when it is `{ "tool": string, "input": object }`. */
function shapeProblem(value: unknown): string | null {
  if (!isPlainObject(value)) return 'expected one JSON object with the keys "tool" and "input"';
  const extra = Object.keys(value).filter((k) => k !== "tool" && k !== "input");
  if (extra.length > 0) {
    return `unexpected key ${extra.map((k) => JSON.stringify(k)).join(", ")}; only "tool" and "input" are allowed`;
  }
  if (!("tool" in value)) return 'missing key "tool"';
  if (typeof value.tool !== "string" || value.tool.trim() === "") return '"tool" must be a non-empty string';
  if (!("input" in value)) return 'missing key "input"';
  if (!isPlainObject(value.input)) return '"input" must be a JSON object';
  return null;
}

/**
 * Classify one model step. Prose with no attempted call (the rule is at `isAttempt`) is the final
 * answer; the first attempted call is parsed as strict JSON into a `ParsedToolCall`, or it becomes an
 * `unparseable` (cut off, unquoted keys, broken JSON) or `bad_shape` error.
 * Only the first call in a step is read; `extra` says whether another one followed it.
 */
export function parseModelStep(text: string): ModelStep {
  const found = candidates(text);
  const index = found.findIndex((c) => isAttempt(c, text));
  const attempt = found[index];
  if (attempt === undefined) return { kind: "answer" };
  const raw = truncate(text.trim());
  if (!attempt.closed) {
    return { kind: "error", error: { code: "unparseable", problem: "the JSON object is missing or never closed", raw } };
  }
  const src = attempt.src;
  let value: unknown;
  try {
    value = JSON.parse(src);
  } catch {
    return {
      kind: "error",
      error: { code: "unparseable", problem: "the tool call is not valid JSON (keys and strings need double quotes)", raw },
    };
  }
  const problem = shapeProblem(value);
  if (problem !== null || !isPlainObject(value) || typeof value.tool !== "string" || !isPlainObject(value.input)) {
    const tool = isPlainObject(value) && typeof value.tool === "string" ? value.tool : undefined;
    return {
      kind: "error",
      error: { code: "bad_shape", problem: problem ?? "not a tool call", raw, ...(tool !== undefined ? { tool } : {}) },
    };
  }
  const end = attempt.start + src.length;
  const extra = found.slice(index + 1).some((c) => c.start >= end && c.keys.includes("tool"));
  return { kind: "call", call: { name: value.tool, input: value.input }, extra };
}
