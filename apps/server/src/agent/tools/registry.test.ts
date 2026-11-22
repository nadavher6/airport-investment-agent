import { describe, expect, it } from "vitest";
import { TOOLS, getTool } from "./registry.ts";
import { renderToolsForPrompt } from "./tool.ts";

const ctx = { signal: new AbortController().signal };

describe("tool registry", () => {
  it("holds the five tools with unique names", () => {
    const names = TOOLS.map((t) => t.name);
    expect(names).toEqual([
      "get_airport_by_code",
      "find_airports_by_city",
      "find_airports_by_region",
      "get_enplanements",
      "score_airports",
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("getTool finds every tool by its name and returns undefined for an unknown name", () => {
    for (const t of TOOLS) expect(getTool(t.name)).toBe(t);
    expect(getTool("get_enplanements")).toBe(TOOLS[3]);
    expect(getTool("nope")).toBeUndefined();
    expect(getTool("")).toBeUndefined();
  });

  it("every tool in TOOLS validates its own exampleInput", () => {
    for (const t of TOOLS) {
      expect(t.inputSchema.safeParse(t.exampleInput).success, t.name).toBe(true);
    }
  });

  it("every tool runs its own exampleInput to an ok result", async () => {
    for (const t of TOOLS) {
      expect((await t.run(t.exampleInput, ctx)).ok, t.name).toBe(true);
    }
  });

  it("renders every tool into the prompt catalogue, with its JSON Schema", () => {
    const block = renderToolsForPrompt(TOOLS);
    for (const t of TOOLS) {
      expect(block).toContain(`### ${t.name}`);
      expect(block).toContain(`Input schema: ${JSON.stringify(t.inputJsonSchema)}`);
      expect(block).toContain(`Example input: ${JSON.stringify(t.exampleInput)}`);
    }
  });
});
