import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool, fail, ok, renderToolsForPrompt, toWireResult } from "./tool.ts";

const ctx = { signal: new AbortController().signal };

describe("tool result helpers", () => {
  it("ok / fail build the discriminated result", () => {
    expect(ok({ a: 1 })).toEqual({ ok: true, output: { a: 1 } });
    expect(fail("not_found", "nope")).toEqual({ ok: false, error: { code: "not_found", message: "nope" } });
  });

  it("toWireResult collapses success to { ok, output }", () => {
    expect(toWireResult(ok({ score: 61.3 }))).toEqual({ ok: true, output: { score: 61.3 } });
  });

  it("toWireResult collapses failure to { ok:false, errorMessage } and drops the code", () => {
    const wire = toWireResult(fail("unavailable", "AirLabs is down."));
    expect(wire).toEqual({ ok: false, errorMessage: "AirLabs is down." });
    expect(wire).not.toHaveProperty("code");
  });
});

describe("defineTool (validation guardrail)", () => {
  const echo = defineTool({
    name: "echo",
    description: "Echoes n back.",
    inputSchema: z.object({ n: z.number().int().positive() }).strict(),
    exampleInput: { n: 1 },
    run: (input) => Promise.resolve(ok({ got: input.n })),
  });

  it("validates input before run and passes the typed value through", async () => {
    expect(await echo.run({ n: 5 }, ctx)).toEqual({ ok: true, output: { got: 5 } });
  });

  it("rejects input that fails the schema with a shared invalid_input error (run not reached)", async () => {
    const result = await echo.run({ n: -1 }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("invalid_input");
      expect(result.error.message).toContain("echo");
      expect(result.error.message).toContain("n");
    }
  });

  it("rejects unknown/extra fields (strict schema)", async () => {
    expect((await echo.run({ n: 1, sneaky: true }, ctx)).ok).toBe(false);
  });
});

describe("renderToolsForPrompt", () => {
  const fakeA = defineTool({
    name: "a_tool",
    description: "Does A. Second sentence.",
    inputSchema: z.object({ x: z.number() }).strict(),
    exampleInput: { x: 1 },
    run: () => Promise.resolve(ok(null)),
  });
  const fakeB = defineTool({
    name: "b_tool",
    description: "Does B.",
    inputSchema: z.object({ y: z.string() }).strict(),
    exampleInput: { y: "z" },
    run: () => Promise.resolve(ok(null)),
  });

  it("renders name, description, and a JSON example per tool", () => {
    const block = renderToolsForPrompt([fakeA, fakeB]);
    expect(block).toContain("### a_tool");
    expect(block).toContain("Does A. Second sentence.");
    expect(block).toContain('Example input: {"x":1}');
    expect(block).toContain("### b_tool");
    expect(block).toContain('Example input: {"y":"z"}');
  });
});
