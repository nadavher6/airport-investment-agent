import type { JsonObject } from "@airport/shared";
import type { ToolError } from "./tools/tool.ts";

/**
 * Tool-call parsing for the ReAct loop (#49). The LlmClient has no native function calling, so
 * the model writes a call as JSON in its text: `{"tool": "<name>", "input": {...}}`, possibly in a
 * ```json fence or after a short lead-in. This module decides whether a model step is a tool call
 * and, if it is, either parses it or returns a typed `ToolCallError`. Nothing here throws.
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
  /** The tool's Zod schema rejected `input`. `problem` is `<path> — <message>` of the first issue. */
  | { readonly code: "invalid_input"; readonly call: ParsedToolCall; readonly problem: string }
  /** The tool ran and returned a `ToolError` (`not_found` / `unavailable` / `internal`). */
  | { readonly code: "tool_failed"; readonly call: ParsedToolCall; readonly error: ToolError }
  /** The exact same tool + input as an earlier call in this turn. */
  | { readonly code: "repeat_call"; readonly call: ParsedToolCall };

/** What one model step turned out to be. */
export type ModelStep =
  | { readonly kind: "answer" }
  | { readonly kind: "call"; readonly call: ParsedToolCall }
  | { readonly kind: "error"; readonly error: ToolCallError };

/** The longest slice of the model's own text quoted back to it in feedback. */
const MAX_RAW_CHARS = 600;

const FENCE = /```[a-zA-Z]*[ \t]*\r?\n?([\s\S]*?)(?:```|$)/;
const TOOL_KEY_OBJECT = /\{\s*"tool"\s*:/;

/** The body of the first ``` fence that mentions "tool", or null. */
function toolFenceBody(text: string): string | null {
  const match = FENCE.exec(text);
  const body = match?.[1];
  return body !== undefined && body.includes('"tool"') ? body : null;
}

/**
 * Does this step look like an attempted tool call? Yes when it starts with `{`, when a ``` fence
 * mentions "tool", or when a `{"tool": ...` object appears anywhere (a call after a lead-in).
 */
export function looksLikeToolCall(text: string): boolean {
  return text.trimStart().startsWith("{") || toolFenceBody(text) !== null || TOOL_KEY_OBJECT.test(text);
}

/** From the first '{', the source of a balanced JSON object, or null when it never closes. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
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
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Where the call most likely starts: a mentioning fence, else a `{"tool"` object, else the first `{`. */
function callSource(text: string): string {
  const fence = toolFenceBody(text);
  if (fence !== null) return fence;
  const keyed = TOOL_KEY_OBJECT.exec(text);
  return keyed ? text.slice(keyed.index) : text;
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
 * Classify one model step. Prose with no sign of a call is the final answer; anything that looks
 * like a call is parsed into a `ParsedToolCall` or an `unparseable` / `bad_shape` error.
 * Only the first call in a step is read.
 */
export function parseModelStep(text: string): ModelStep {
  if (!looksLikeToolCall(text)) return { kind: "answer" };
  const raw = truncate(text.trim());
  const src = firstJsonObject(callSource(text));
  if (src === null) {
    return { kind: "error", error: { code: "unparseable", problem: "the JSON object is missing or never closed", raw } };
  }
  let value: unknown;
  try {
    value = JSON.parse(src);
  } catch {
    return { kind: "error", error: { code: "unparseable", problem: "the tool call is not valid JSON", raw } };
  }
  const problem = shapeProblem(value);
  if (problem !== null || !isPlainObject(value) || typeof value.tool !== "string" || !isPlainObject(value.input)) {
    const tool = isPlainObject(value) && typeof value.tool === "string" ? value.tool : undefined;
    return {
      kind: "error",
      error: { code: "bad_shape", problem: problem ?? "not a tool call", raw, ...(tool !== undefined ? { tool } : {}) },
    };
  }
  return { kind: "call", call: { name: value.tool, input: value.input } };
}
