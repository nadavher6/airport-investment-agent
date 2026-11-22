import { describe, expect, it } from "vitest";
import { ALL_TOOLS, toolsByName } from "./registry.ts";
import { renderToolsForPrompt } from "./tool.ts";

describe("tool registry", () => {
  it("holds the four tools with unique names", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    expect(names).toEqual(["get_airport_by_code", "find_airports_by_city", "find_airports_by_region", "get_enplanements"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("indexes tools by name", () => {
    expect(toolsByName.get("get_enplanements")).toBe(ALL_TOOLS[3]);
    expect(toolsByName.get("nope")).toBeUndefined();
  });

  it("renders every tool into the prompt catalogue", () => {
    const block = renderToolsForPrompt(ALL_TOOLS);
    for (const t of ALL_TOOLS) {
      expect(block).toContain(`### ${t.name}`);
      expect(block).toContain(`Example input: ${JSON.stringify(t.exampleInput)}`);
    }
  });
});
