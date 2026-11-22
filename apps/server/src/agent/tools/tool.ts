import type { JsonObject, JsonValue, ToolResult } from "@airport/shared";
import { z } from "zod";
import type { ZodError, ZodType } from "zod";

/**
 * The agent tool contract. A tool declares the five things the main agent needs: a name, a
 * prompt-ready description, a Zod input schema (the guardrail), one example input, and the
 * actual code. `Tool<Input, Output>` is what an author writes; `defineTool` turns it into a
 * `RegisteredTool` with input validation baked in, ready for the tool registry.
 *
 * The main agent (a) renders each tool's name + description + input JSON Schema + example into the system prompt
 * (`renderToolsForPrompt`), (b) runs it via `RegisteredTool.run`, which validates the model's
 * arguments first, and (c) maps the result to the wire `ToolResult` (`toWireResult`).
 */

// ---------------------------------------------------------------------------
// Shared error output — the SAME shape for every tool.
// ---------------------------------------------------------------------------

export type ToolErrorCode =
  | "invalid_input" // input failed schema validation (missing / malformed field)
  | "not_found" //     a valid request matched nothing (e.g. unknown airport)
  | "unavailable" //   an upstream dependency (API / dataset) was unreachable
  | "internal"; //     an unexpected failure

/**
 * A tool failure the model and the UI can both see. `message` is one plain-English sentence
 * and MUST NOT contain secrets, keys, URLs, or stack traces.
 */
export interface ToolError {
  readonly code: ToolErrorCode;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Run result — the tool's own typed output, or the shared error. Tools never throw.
// ---------------------------------------------------------------------------

export type ToolRunResult<Output> =
  | { readonly ok: true; readonly output: Output }
  | { readonly ok: false; readonly error: ToolError };

/** Passed to every `run`, so a tool can honour Stop / client disconnect. */
export interface ToolContext {
  readonly signal: AbortSignal;
}

// ---------------------------------------------------------------------------
// Authoring contract (what each tool implements).
// ---------------------------------------------------------------------------

/**
 * @typeParam Input  - the validated argument object (the Zod schema's output type).
 * @typeParam Output - the success payload. Must be JSON-serializable; the framework
 *                     serializes it at the wire boundary, so a tool may use its own domain
 *                     type here (e.g. an `AirportRecord`).
 */
export interface Tool<Input, Output> {
  /** Stable snake_case id, used in the tool_call event and the prompt. */
  readonly name: string;
  /** Concise (prefer ≤2 sentences; more is fine when usage rules matter). Injected verbatim into the prompt. */
  readonly description: string;
  /** Guardrail: the model's arguments are parsed with this before `run` is called. */
  readonly inputSchema: ZodType<Input>;
  /** One example input, rendered in the prompt so the model learns the argument shape. */
  readonly exampleInput: Input;
  /** The actual tool. MUST NOT throw: map every failure to a `ToolError`. */
  run(input: Input, ctx: ToolContext): Promise<ToolRunResult<Output>>;
}

// ---------------------------------------------------------------------------
// Registry form (type-erased, validation baked in).
// ---------------------------------------------------------------------------

/** A tool after `defineTool`: it validates unknown input, then runs. Stored in the registry. */
export interface RegisteredTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType;
  /** `inputSchema` as JSON Schema (the input side, computed once), shown to the model in the prompt. */
  readonly inputJsonSchema: JsonObject;
  readonly exampleInput: JsonValue;
  /**
   * Validates `rawInput` against `inputSchema` (failure: `invalid_input`), then runs the tool.
   * Never rejects: a throw, a rejection or an abort becomes an `internal` error.
   */
  run(rawInput: JsonValue, ctx: ToolContext): Promise<ToolRunResult<JsonValue>>;
}

// ---------------------------------------------------------------------------
// Result constructors.
// ---------------------------------------------------------------------------

/** Build a success result. */
export const ok = <Output>(output: Output): ToolRunResult<Output> => ({ ok: true, output });

/** Build a failure result with the shared error shape. */
export const fail = (code: ToolErrorCode, message: string): ToolRunResult<never> => ({
  ok: false,
  error: { code, message },
});

// ---------------------------------------------------------------------------
// Framework helpers.
// ---------------------------------------------------------------------------

/** One plain sentence from a Zod failure, naming the field but not dumping the user's value. */
function firstIssueMessage(toolName: string, error: ZodError): string {
  const issue = error.issues[0];
  const field = issue && issue.path.length > 0 ? issue.path.join(".") : "input";
  return `Invalid input for ${toolName}: ${field} — ${issue?.message ?? "failed validation"}.`;
}

/** The plain sentence returned when the run was stopped (Stop button or client disconnect). */
const abortedMessage = (toolName: string): string => `${toolName} was stopped before it finished.`;

/**
 * Turn an authored `Tool` into a `RegisteredTool`: validation (the guardrail) is applied to
 * the model's raw arguments before the tool's own `run` is reached, so `run` only ever sees
 * well-formed input.
 */
export function defineTool<Input, Output>(tool: Tool<Input, Output>): RegisteredTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    // io "input": the model writes the input, and a transform (e.g. uppercasing) has no JSON form.
    inputJsonSchema: z.toJSONSchema(tool.inputSchema, { io: "input" }) as JsonObject,
    exampleInput: tool.exampleInput as JsonValue,
    async run(rawInput, ctx) {
      // Tools never throw: a schema that throws, a run() that throws or rejects, and an abort
      // all become a ToolError, so one bad tool cannot crash the turn. The original error is
      // never put in the message (no stack, no secrets).
      try {
        if (ctx.signal.aborted) return fail("internal", abortedMessage(tool.name));
        const parsed = tool.inputSchema.safeParse(rawInput);
        if (!parsed.success) return fail("invalid_input", firstIssueMessage(tool.name, parsed.error));
        const result = await tool.run(parsed.data, ctx);
        return result.ok ? { ok: true, output: result.output as JsonValue } : result;
      } catch {
        return fail("internal", ctx.signal.aborted ? abortedMessage(tool.name) : `${tool.name} failed unexpectedly.`);
      }
    },
  };
}

/**
 * Collapse a run result to the wire `ToolResult` (shared contract). The rich `ToolError`
 * reduces to its message; the `code` stays server-side.
 */
export function toWireResult(result: ToolRunResult<JsonValue>): ToolResult {
  return result.ok ? { ok: true, output: result.output } : { ok: false, errorMessage: result.error.message };
}

/**
 * Render the tool catalogue for the system prompt: each tool's name, description, its input
 * JSON Schema (so the model sees required/optional fields, enums and nested shapes) and one
 * example input. The main prompt is then `basePersona + "\n\n## Tools\n" + this`.
 */
export function renderToolsForPrompt(tools: readonly RegisteredTool[]): string {
  return tools
    .map(
      (t) =>
        `### ${t.name}\n${t.description}\nInput schema: ${JSON.stringify(t.inputJsonSchema)}\n` +
        `Example input: ${JSON.stringify(t.exampleInput)}`,
    )
    .join("\n\n");
}
