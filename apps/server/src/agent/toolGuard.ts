import type { JsonValue } from "@airport/shared";
import type { RegisteredTool, ToolContext } from "./tools/tool.ts";
import type { ParsedToolCall, ToolCallError } from "./toolCall.ts";

/**
 * Tool-call guardrails for the ReAct loop (#49): validate a parsed call, run it, render the
 * feedback block the model gets when a call goes wrong, and the retry policy. Nothing here throws.
 */

// ---------------------------------------------------------------------------
// Policy constants (the one place they live).
// ---------------------------------------------------------------------------

/** Max tool steps in one turn, valid or not. Invalid attempts and retries count toward it. */
export const MAX_TOOL_STEPS = 6;

/**
 * Max retries after an invalid attempt: the first invalid attempt and 2 retries. When the
 * 3rd invalid attempt in a row comes back, the loop stops calling tools.
 */
export const MAX_INVALID_RETRIES = 2;

/** The longest model-controlled value (tool name, raw text, problem, error message) echoed anywhere. */
export const MAX_ECHO_CHARS = 200;
/** Marks a value cut at MAX_ECHO_CHARS. */
export const ECHO_ELLIPSIS = "…[truncated]";

// ---------------------------------------------------------------------------
// Validation + run.
// ---------------------------------------------------------------------------

/** A stable key for "same tool + same input": the name and the input's JSON with sorted keys. */
export function callKey(call: ParsedToolCall): string {
  return `${call.name}\u0000${canonicalJson(call.input)}`;
}

function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k] ?? null)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export type GuardedResult =
  | { readonly ok: true; readonly tool: RegisteredTool; readonly output: JsonValue }
  | { readonly ok: false; readonly error: ToolCallError };

/** `<path> — <message>` of the first Zod issue, or null when the input is valid. */
function firstSchemaProblem(tool: RegisteredTool, input: JsonValue): string | null {
  try {
    const parsed = tool.inputSchema.safeParse(input);
    if (parsed.success) return null;
    const issue = parsed.error.issues[0];
    const field = issue && issue.path.length > 0 ? issue.path.join(".") : "input";
    return `${field} — ${issue?.message ?? "failed validation"}`;
  } catch {
    return null; // a throwing schema: let the tool's own run() turn it into an internal error
  }
}

/** A loop-level input rule on top of a tool's schema: `<path> — <message>` when it rejects the call. */
export type LoopRule = (call: ParsedToolCall) => string | null;

/**
 * Check a parsed call against the allowed tools and this turn's earlier calls, then run it.
 * `seen` holds the keys of calls with a final result this turn: a success or a `not_found`. A call that
 * failed for a passing reason (`unavailable`, `internal`) is not added, so the model may retry it.
 * Order: unknown_tool, repeat_call, invalid_input (the tool's schema, then `rule`), then the run.
 */
export async function runGuarded(
  call: ParsedToolCall,
  tools: readonly RegisteredTool[],
  seen: Set<string>,
  ctx: ToolContext,
  rule: LoopRule = () => null,
): Promise<GuardedResult> {
  const tool = tools.find((t) => t.name === call.name);
  if (tool === undefined) return { ok: false, error: { code: "unknown_tool", call } };
  const key = callKey(call);
  if (seen.has(key)) return { ok: false, error: { code: "repeat_call", call } };
  const problem = firstSchemaProblem(tool, call.input) ?? rule(call);
  if (problem !== null) return { ok: false, error: { code: "invalid_input", call, problem } };
  const result = await tool.run(call.input, ctx);
  if (result.ok || result.error.code === "not_found") seen.add(key);
  if (result.ok) return { ok: true, tool, output: result.output };
  if (result.error.code === "invalid_input") {
    const problem = result.error.message.replace(/^Invalid input for [^:]+: /, "");
    return { ok: false, error: { code: "invalid_input", call, problem } };
  }
  return { ok: false, error: { code: "tool_failed", call, error: result.error } };
}

// ---------------------------------------------------------------------------
// Retry policy.
// ---------------------------------------------------------------------------

/** A valid call that found no data: tell the model, but do not ask it to retry. */
export const isNoData = (error: ToolCallError): boolean =>
  error.code === "tool_failed" && error.error.code === "not_found";

/** The invalid-attempt streak after this outcome (`null` = the call succeeded). */
export function nextInvalidStreak(streak: number, error: ToolCallError | null): number {
  return error === null || isNoData(error) ? 0 : streak + 1;
}

/** True when the streak is past the retry budget: stop calling tools and answer. */
export const retriesExhausted = (streak: number): boolean => streak > MAX_INVALID_RETRIES;

// ---------------------------------------------------------------------------
// Messages.
// ---------------------------------------------------------------------------

/** A model-controlled value cut to MAX_ECHO_CHARS (plus ECHO_ELLIPSIS), for the cards and UI messages. */
export function capEcho(value: string): string {
  return value.length > MAX_ECHO_CHARS ? `${value.slice(0, MAX_ECHO_CHARS)}${ECHO_ELLIPSIS}` : value;
}

/** U+2028 and U+2029: JSON.stringify leaves them raw, but they can read as line breaks. */
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, "g");

/**
 * A model-controlled value for the feedback block: capped, then one JSON string literal. It holds no
 * line break (U+2028/U+2029 escaped too), so it can never start a line such as a forged END_TOOL_CALL_ERROR.
 */
export function echo(value: string): string {
  return JSON.stringify(capEcho(value)).replace(LINE_SEPARATORS, (ch) => `\\u${ch.charCodeAt(0).toString(16)}`);
}

/** The name a failed attempt shows on its tool card (capped). */
export function errorToolName(error: ToolCallError): string {
  switch (error.code) {
    case "unparseable":
      return "unreadable_tool_call";
    case "bad_shape":
      return error.tool !== undefined ? capEcho(error.tool) : "unreadable_tool_call";
    case "unknown_tool":
    case "invalid_input":
    case "tool_failed":
    case "repeat_call":
      return capEcho(error.call.name);
  }
}

/** One short plain sentence for the failed tool card, ending with the error code (echoed values capped). */
export function errorUiMessage(error: ToolCallError): string {
  switch (error.code) {
    case "unparseable":
      return `The tool call could not be read: ${error.problem} (unparseable).`;
    case "bad_shape":
      return `The tool call had the wrong shape: ${capEcho(error.problem)} (bad_shape).`;
    case "unknown_tool":
      return `There is no tool called "${capEcho(error.call.name)}" (unknown_tool).`;
    case "invalid_input":
      return `Invalid input for ${capEcho(error.call.name)}: ${capEcho(error.problem).replace(/\.$/, "")} (invalid_input).`;
    case "tool_failed":
      return `${capEcho(error.error.message).replace(/\.$/, "")} (tool_failed: ${error.error.code}).`;
    case "repeat_call":
      return `${capEcho(error.call.name)} was already called with this exact input, so it was not run again (repeat_call).`;
  }
}

/** The JSON Schema of a tool call itself, with the allowed names. */
function callEnvelopeSchema(tools: readonly RegisteredTool[]): string {
  return JSON.stringify({
    type: "object",
    properties: { tool: { type: "string", enum: tools.map((t) => t.name) }, input: { type: "object" } },
    required: ["tool", "input"],
    additionalProperties: false,
  });
}

function allowedToolsLines(tools: readonly RegisteredTool[]): string {
  return tools.map((t) => `- ${t.name}: ${JSON.stringify(t.inputJsonSchema)}`).join("\n");
}

const RETRY_LINE = "Reply with ONE corrected tool call as JSON only, or answer the user without this tool.";
const NO_DATA_LINE =
  "The call was valid, but this data does not exist. Do not retry it. Tell the user plainly that there is no data for it, and never invent it.";
const REPEAT_LINE = "Do not repeat it. Use the earlier result, call a different tool or input as JSON only, or answer the user.";

/**
 * The feedback block the model gets after a failed attempt. It is data from the runtime, not
 * instructions from the user: delimited, and it only quotes the model's own previous call.
 * Every model-controlled value (tool name, raw text, problem, error message, the previous call) goes
 * through `echo`: one capped JSON string on its line, so the block is bounded and only the real
 * END_TOOL_CALL_ERROR line can close it.
 */
export function renderFeedback(error: ToolCallError, tools: readonly RegisteredTool[]): string {
  const lines: string[] = ["TOOL_CALL_ERROR", `code: ${error.code}`];
  const schemaOf = (name: string): string => {
    const tool = tools.find((t) => t.name === name);
    return tool ? JSON.stringify(tool.inputJsonSchema) : "{}";
  };
  const previousCall = (call: ParsedToolCall): string =>
    `your previous call: ${echo(JSON.stringify({ tool: call.name, input: call.input }))}`;
  switch (error.code) {
    case "unparseable":
    case "bad_shape":
      lines.push(
        `tool: ${error.code === "bad_shape" && error.tool !== undefined ? echo(error.tool) : "(unknown)"}`,
        `problem: ${echo(error.problem)}`,
        `expected call (JSON Schema): ${callEnvelopeSchema(tools)}`,
        `allowed tools (input JSON Schema each):\n${allowedToolsLines(tools)}`,
        `your previous call: ${echo(error.raw)}`,
        RETRY_LINE,
      );
      break;
    case "unknown_tool":
      lines.push(
        `tool: ${echo(error.call.name)}`,
        `problem: there is no tool called ${echo(error.call.name)}`,
        `allowed tools (input JSON Schema each):\n${allowedToolsLines(tools)}`,
        previousCall(error.call),
        RETRY_LINE,
      );
      break;
    case "invalid_input":
      lines.push(
        `tool: ${echo(error.call.name)}`,
        `problem: ${echo(error.problem)}`,
        `expected input (JSON Schema): ${schemaOf(error.call.name)}`,
        previousCall(error.call),
        RETRY_LINE,
      );
      break;
    case "tool_failed":
      lines.push(
        `tool: ${echo(error.call.name)}`,
        `problem: ${error.error.code} — ${echo(error.error.message)}`,
        `expected input (JSON Schema): ${schemaOf(error.call.name)}`,
        previousCall(error.call),
        error.error.code === "not_found" ? NO_DATA_LINE : RETRY_LINE,
      );
      break;
    case "repeat_call":
      lines.push(
        `tool: ${echo(error.call.name)}`,
        "problem: this exact call was already made in this turn; its result is above",
        `expected input (JSON Schema): ${schemaOf(error.call.name)}`,
        previousCall(error.call),
        REPEAT_LINE,
      );
      break;
    default: {
      const unhandled: never = error;
      return unhandled;
    }
  }
  lines.push("END_TOOL_CALL_ERROR");
  return lines.join("\n");
}

/** Why the loop stopped calling tools. */
export type ToolsOffReason = "retries_exhausted" | "step_cap";

/** Appended to the last observation when tools are switched off: answer now, in plain English. */
export function renderToolsOff(reason: ToolsOffReason): string {
  const why =
    reason === "retries_exhausted"
      ? "the last tool calls were invalid too many times in a row"
      : `the limit of ${MAX_TOOL_STEPS} tool steps for one turn was reached`;
  return [
    "TOOLS_DISABLED",
    `reason: ${why}`,
    "Tools are switched off for the rest of this turn. Do not write JSON or a tool call.",
    "Answer the user now in plain English, using only the tool results above. Say plainly what you could not look up, and never invent numbers.",
    "END_TOOLS_DISABLED",
  ].join("\n");
}

/** Shown when even the no-tools answer is empty or still a tool call. */
export const GRACEFUL_FALLBACK =
  "I couldn't look up the data I needed to answer this reliably, so I won't guess. " +
  "Please try rephrasing, or name the airports by their 3-letter codes (for example BOS or LAX).";
