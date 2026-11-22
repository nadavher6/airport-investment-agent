import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineTool, fail, ok, renderToolsForPrompt, toWireResult } from "./tool.ts";
import { getEnplanementsTool } from "./enplanementsTool.ts";
import type { AirportRecord } from "../../data/enplanements/types.ts";

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
    const result = await echo.run({ n: 1, sneaky: true }, ctx);
    expect(result.ok).toBe(false);
  });
});

describe("renderToolsForPrompt", () => {
  it("renders name, description, and a JSON example per tool", () => {
    const block = renderToolsForPrompt([getEnplanementsTool]);
    expect(block).toContain("### get_enplanements");
    expect(block).toContain("official FAA passenger-boarding");
    expect(block).toContain('Example input: {"airport_code":"LAX"}');
  });
});

describe("getEnplanementsTool (example implementation)", () => {
  it("has a prompt-ready description of at most 2 sentences", () => {
    const sentences = getEnplanementsTool.description.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });

  it("normalizes a lowercased code (schema transform) and returns the record", async () => {
    const result = await getEnplanementsTool.run({ airport_code: "lax" }, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.output as unknown as AirportRecord).airportCode).toBe("LAX");
  });

  it("returns a shared not_found error for an unknown code", async () => {
    const result = await getEnplanementsTool.run({ airport_code: "ZZZ" }, ctx);
    expect(result).toEqual({ ok: false, error: { code: "not_found", message: expect.stringContaining("ZZZ") } });
  });

  it("returns invalid_input for a blank code (schema guardrail)", async () => {
    const result = await getEnplanementsTool.run({ airport_code: "  " }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_input");
  });
});
