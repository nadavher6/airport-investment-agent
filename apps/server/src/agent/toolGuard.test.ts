import { describe, expect, it } from "vitest";
import { callKey, errorUiMessage, nextInvalidStreak, renderFeedback, retriesExhausted, runGuarded, MAX_INVALID_RETRIES } from "./toolGuard.ts";
import { FAKE_TOOLS, lookupTool } from "./toolGuard.fixtures.ts";

const ctx = { signal: new AbortController().signal };

describe("runGuarded", () => {
  it("runs a valid call and remembers it", async () => {
    const seen = new Set<string>();
    const result = await runGuarded({ name: "lookup", input: { code: "BOS" } }, FAKE_TOOLS, seen, ctx);
    expect(result).toMatchObject({ ok: true, output: { code: "BOS" } });
    expect(seen.size).toBe(1);
  });

  it("unknown_tool for a name outside the allowed list", async () => {
    const result = await runGuarded({ name: "delete_db", input: {} }, FAKE_TOOLS, new Set(), ctx);
    expect(result).toMatchObject({ ok: false, error: { code: "unknown_tool" } });
  });

  it("invalid_input with the first issue's path and message, without running the tool", async () => {
    const seen = new Set<string>();
    const result = await runGuarded({ name: "lookup", input: { code: 123 } }, FAKE_TOOLS, seen, ctx);
    expect(result.ok).toBe(false);
    if (result.ok || result.error.code !== "invalid_input") throw new Error("expected invalid_input");
    expect(result.error.problem).toMatch(/^code — /);
    expect(seen.size).toBe(0);
  });

  it("tool_failed carries the ToolError", async () => {
    const result = await runGuarded({ name: "lookup", input: { code: "ERR" } }, FAKE_TOOLS, new Set(), ctx);
    expect(result).toMatchObject({ ok: false, error: { code: "tool_failed", error: { code: "unavailable" } } });
  });

  it("repeat_call for the same tool and input, whatever the key order", async () => {
    const seen = new Set<string>();
    await runGuarded({ name: "lookup", input: { code: "BOS", note: "a" } }, FAKE_TOOLS, seen, ctx);
    const again = await runGuarded({ name: "lookup", input: { note: "a", code: "BOS" } }, FAKE_TOOLS, seen, ctx);
    expect(again).toMatchObject({ ok: false, error: { code: "repeat_call" } });
    expect(callKey({ name: "lookup", input: { a: 1, b: [1, { c: 2, d: 3 }] } })).toBe(
      callKey({ name: "lookup", input: { b: [1, { d: 3, c: 2 }], a: 1 } }),
    );
  });
});

describe("renderFeedback", () => {
  it("is delimited and carries code, problem, schema, the previous call and the retry line", () => {
    const block = renderFeedback({ code: "invalid_input", call: { name: "lookup", input: { code: 1 } }, problem: "code — bad" }, FAKE_TOOLS);
    const lines = block.split("\n");
    expect(lines[0]).toBe("TOOL_CALL_ERROR");
    expect(lines.at(-1)).toBe("END_TOOL_CALL_ERROR");
    expect(block).toContain("code: invalid_input");
    expect(block).toContain("tool: lookup");
    expect(block).toContain("problem: code — bad");
    expect(block).toContain(`expected input (JSON Schema): ${JSON.stringify(lookupTool.inputJsonSchema)}`);
    expect(block).toContain('your previous call: {"tool":"lookup","input":{"code":1}}');
    expect(block).toContain("Reply with ONE corrected tool call as JSON only, or answer the user without this tool.");
  });

  it("unknown_tool lists every allowed tool with its schema", () => {
    const block = renderFeedback({ code: "unknown_tool", call: { name: "delete_db", input: {} } }, FAKE_TOOLS);
    for (const t of FAKE_TOOLS) expect(block).toContain(`- ${t.name}: ${JSON.stringify(t.inputJsonSchema)}`);
  });

  it("not_found says there is no data and not to retry", () => {
    const block = renderFeedback(
      { code: "tool_failed", call: { name: "lookup", input: { code: "ZZZ" } }, error: { code: "not_found", message: "No data for ZZZ." } },
      FAKE_TOOLS,
    );
    expect(block).toContain("Do not retry it");
    expect(block).not.toContain("Reply with ONE corrected tool call");
  });

  it("gives a short UI message ending with the code", () => {
    expect(errorUiMessage({ code: "unknown_tool", call: { name: "delete_db", input: {} } })).toBe(
      'There is no tool called "delete_db" (unknown_tool).',
    );
  });
});

describe("retry policy", () => {
  it("allows MAX_INVALID_RETRIES retries after the first invalid attempt", () => {
    const err = { code: "unknown_tool", call: { name: "x", input: {} } } as const;
    let streak = 0;
    for (let i = 0; i <= MAX_INVALID_RETRIES; i++) {
      expect(retriesExhausted(streak)).toBe(false);
      streak = nextInvalidStreak(streak, err);
    }
    expect(retriesExhausted(streak)).toBe(true);
    expect(nextInvalidStreak(streak, null)).toBe(0);
  });

  it("a not_found does not count as an invalid attempt", () => {
    const noData = { code: "tool_failed", call: { name: "x", input: {} }, error: { code: "not_found", message: "none" } } as const;
    expect(nextInvalidStreak(2, noData)).toBe(0);
  });
});
