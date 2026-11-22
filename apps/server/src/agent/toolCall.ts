import type { JsonObject } from "@airport/shared";

/** A parsed tool-use directive from the model's text. */
export interface ParsedToolCall {
  readonly name: string;
  readonly input: JsonObject;
}

/** Scan from the first '{' for a balanced JSON object and return its source, or null. */
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

/**
 * Parse a tool call out of a model turn. The model is told to reply with ONLY
 * `{"tool": "<name>", "input": {...}}`, optionally in a ```json fence. Returns null when the text
 * is not a tool call (i.e. it's the final prose answer), or names an unknown tool.
 */
export function parseToolCall(text: string, isKnownTool: (name: string) => boolean): ParsedToolCall | null {
  const src = firstJsonObject(text);
  if (src === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(src);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const { tool, input } = value as Record<string, unknown>;
  if (typeof tool !== "string" || !isKnownTool(tool)) return null;
  const safeInput: JsonObject =
    typeof input === "object" && input !== null && !Array.isArray(input) ? (input as JsonObject) : {};
  return { name: tool, input: safeInput };
}
