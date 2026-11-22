import { z } from "zod";
import { defineTool, fail, ok, type RegisteredTool } from "./tools/tool.ts";

/**
 * Fake tools for the guardrail tests (#49): no dataset, deterministic results.
 * `lookup` returns its code, `not_found` for "ZZZ" and `unavailable` for "ERR".
 */
export const lookupTool: RegisteredTool = defineTool({
  name: "lookup",
  description: "Look up an airport by its 3-letter code.",
  inputSchema: z.strictObject({ code: z.string().length(3), note: z.string().optional() }),
  exampleInput: { code: "BOS" },
  run: async ({ code }) => {
    if (code === "ZZZ") return fail("not_found", `No data for ${code}.`);
    if (code === "ERR") return fail("unavailable", "The data source is unavailable.");
    return ok({ code, passengers: 1000 });
  },
});

export const listTool: RegisteredTool = defineTool({
  name: "list_cities",
  description: "Airports for a list of cities.",
  inputSchema: z.strictObject({ cities: z.array(z.string()).min(1) }),
  exampleInput: { cities: ["Boston"] },
  run: async ({ cities }) => ok({ cities }),
});

export const FAKE_TOOLS: readonly RegisteredTool[] = [lookupTool, listTool];
