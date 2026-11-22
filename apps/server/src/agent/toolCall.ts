import type { JsonObject } from "@airport/shared";

/**
 * What one model step of the tool loop (#48) is:
 * - `answer`: prose with no tool call in it (the final answer);
 * - `call`: the first `{"tool": "<name>", "input": {...}}` object found, bare, in a ```json fence or after a
 *   lead-in sentence. `input` is the raw object: the tool's zod schema validates it (RegisteredTool.run).
 *   `extra` is true when the step held more than one call (only the first is run);
 * - `bad`: the step looks like a tool call (a `"tool":` key) but none could be read (malformed JSON, or `tool`
 *   is not a string, or `input` is not an object). The loop feeds this back once, and never shows the text to the user.
 * Whether the name is a known tool is the loop's check, not the parser's.
 */
export type ParsedStep =
  | { readonly kind: "answer" }
  | { readonly kind: "call"; readonly name: string; readonly input: JsonObject; readonly extra: boolean }
  | { readonly kind: "bad"; readonly reason: string };

/** A `"tool":` key anywhere: the step meant to call a tool, even if its JSON is broken. */
const LOOKS_LIKE_CALL = /"tool"\s*:/;

/** Every balanced top-level `{...}` in the text (string-aware), in order. */
function jsonObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"' && depth > 0) inString = true;
    else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0) out.push(text.slice(start, i + 1));
    }
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Parses one model step. Never throws. */
export function parseToolCall(text: string): ParsedStep {
  if (!LOOKS_LIKE_CALL.test(text)) return { kind: "answer" };
  const calls: { name: unknown; input: unknown }[] = [];
  for (const src of jsonObjects(text)) {
    let value: unknown;
    try {
      value = JSON.parse(src);
    } catch {
      continue;
    }
    if (isObject(value) && "tool" in value) calls.push({ name: value.tool, input: value.input });
  }
  const first = calls[0];
  if (first === undefined) return { kind: "bad", reason: "the tool call was not valid JSON" };
  if (typeof first.name !== "string" || first.name.trim() === "") return { kind: "bad", reason: 'the "tool" field must be a tool name' };
  // A missing input is {}. The object goes to the tool's zod schema as-is (JSON.parse only yields JSON values).
  if (first.input !== undefined && !isObject(first.input)) return { kind: "bad", reason: 'the "input" field must be a JSON object' };
  const input = (first.input ?? {}) as JsonObject;
  return { kind: "call", name: first.name, input, extra: calls.length > 1 };
}
