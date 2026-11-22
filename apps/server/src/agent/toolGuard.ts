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

/**
 * Check a parsed call against the allowed tools and this turn's earlier calls, then run it.
 * `seen` holds the keys of calls already run this turn; a call that runs is added to it.
 */
export async function runGuarded(
  call: ParsedToolCall,
  tools: readonly RegisteredTool[],
  seen: Set<string>,
  ctx: ToolContext,
): Promise<GuardedResult> {
  const tool = tools.find((t) => t.name === call.name);
  if (tool === undefined) return { ok: false, error: { code: "unknown_tool", call } };
  const key = callKey(call);
  if (seen.has(key)) return { ok: false, error: { code: "repeat_call", call } };
  const problem = firstSchemaProblem(tool, call.input);
  if (problem !== null) return { ok: false, error: { code: "invalid_input", call, problem } };
  seen.add(key);
  const result = await tool.run(call.input, ctx);
  if (result.ok) return { ok: true, tool, output: result.output };
  if (result.error.code === "invalid_input") {
    return { ok: false, error: { code: "invalid_input", call, problem: result.error.message } };
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

/** The name a failed attempt shows on its tool card. */
export function errorToolName(error: ToolCallError): string {
  switch (error.code) {
    case "unparseable":
      return "unreadable_tool_call";
    case "bad_shape":
      return error.tool ?? "unreadable_tool_call";
    case "unknown_tool":
    case "invalid_input":
    case "tool_failed":
    case "repeat_call":
      return error.call.name;
  }
}

/** One short plain sentence for the failed tool card, ending with the error code. */
export function errorUiMessage(error: ToolCallError): string {
  switch (error.code) {
    case "unparseable":
      return `The tool call could not be read: ${error.problem} (unparseable).`;
    case "bad_shape":
      return `The tool call had the wrong shape: ${error.problem} (bad_shape).`;
    case "unknown_tool":
      return `There is no tool called "${error.call.name}" (unknown_tool).`;
    case "invalid_input":
      return `Invalid input for ${error.call.name}: ${error.problem} (invalid_input).`;
    case "tool_failed":
      return `${error.error.message} (tool_failed: ${error.error.code}).`;
    case "repeat_call":
      return `${error.call.name} was already called with this exact input, so it was not run again (repeat_call).`;
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

/**
 * The feedback block the model gets after a failed attempt. It is data from the runtime, not
 * instructions from the user: delimited, and it only quotes the model's own previous call.
 */
export function renderFeedback(error: ToolCallError, tools: readonly RegisteredTool[]): string {
  const lines: string[] = ["TOOL_CALL_ERROR", `code: ${error.code}`];
  const schemaOf = (name: string): string => {
    const tool = tools.find((t) => t.name === name);
    return tool ? JSON.stringify(tool.inputJsonSchema) : "{}";
  };
  switch (error.code) {
    case "unparseable":
    case "bad_shape":
      lines.push(
        `tool: ${error.code === "bad_shape" && error.tool !== undefined ? error.tool : "(unknown)"}`,
        `problem: ${error.problem}`,
        `expected call (JSON Schema): ${callEnvelopeSchema(tools)}`,
        `allowed tools (input JSON Schema each):\n${allowedToolsLines(tools)}`,
        `your previous call: ${error.raw}`,
        RETRY_LINE,
      );
      break;
    case "unknown_tool":
      lines.push(
        `tool: ${error.call.name}`,
        `problem: there is no tool called "${error.call.name}"`,
        `allowed tools (input JSON Schema each):\n${allowedToolsLines(tools)}`,
        `your previous call: ${JSON.stringify({ tool: error.call.name, input: error.call.input })}`,
        RETRY_LINE,
      );
      break;
    case "invalid_input":
      lines.push(
        `tool: ${error.call.name}`,
        `problem: ${error.problem}`,
        `expected input (JSON Schema): ${schemaOf(error.call.name)}`,
        `your previous call: ${JSON.stringify({ tool: error.call.name, input: error.call.input })}`,
        RETRY_LINE,
      );
      break;
    case "tool_failed":
      lines.push(
        `tool: ${error.call.name}`,
        `problem: ${error.error.code} — ${error.error.message}`,
        `expected input (JSON Schema): ${schemaOf(error.call.name)}`,
        `your previous call: ${JSON.stringify({ tool: error.call.name, input: error.call.input })}`,
        error.error.code === "not_found"
          ? "The call was valid, but this data does not exist. Do not retry it. Tell the user plainly that there is no data for it, and never invent it."
          : RETRY_LINE,
      );
      break;
    case "repeat_call":
      lines.push(
        `tool: ${error.call.name}`,
        "problem: this exact call was already made in this turn; its result is above",
        `expected input (JSON Schema): ${schemaOf(error.call.name)}`,
        `your previous call: ${JSON.stringify({ tool: error.call.name, input: error.call.input })}`,
        "Do not repeat it. Use the earlier result, call a different tool or input as JSON only, or answer the user.",
      );
      break;
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
