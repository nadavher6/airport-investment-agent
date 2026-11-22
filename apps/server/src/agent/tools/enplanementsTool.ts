import { z } from "zod";
import { findAirport } from "../../data/enplanements/dataset.ts";
import type { AirportRecord } from "../../data/enplanements/types.ts";
import { defineTool, fail, ok } from "./tool.ts";

/**
 * Example tool: official FAA enplanement data for one US airport.
 * Shows the full contract — a Zod input schema (guardrail), a typed success output
 * (`AirportRecord`), and the shared error for the "unknown code" case.
 */

/** Guardrail: trims, requires a non-empty code, and normalizes to uppercase. */
export const getEnplanementsInputSchema = z
  .object({
    airport_code: z
      .string()
      .trim()
      .min(1, "airport_code is required")
      .transform((code) => code.toUpperCase()),
  })
  .strict();

export type GetEnplanementsInput = z.infer<typeof getEnplanementsInputSchema>;

/** Normal (success) output type for this tool. */
export type GetEnplanementsOutput = AirportRecord;

export const getEnplanementsTool = defineTool<GetEnplanementsInput, GetEnplanementsOutput>({
  name: "get_enplanements",

  description:
    "Returns official FAA passenger-boarding (enplanement) data for a US airport: latest-year total, " +
    "hub class, national rank, year-over-year change, 5/10-year CAGR, and COVID recovery ratio (CY2015–CY2024).",

  inputSchema: getEnplanementsInputSchema,

  exampleInput: { airport_code: "LAX" },

  run(input, _ctx) {
    // input.airport_code is already validated and uppercased by the schema.
    const record = findAirport(input.airport_code);
    if (record === null) {
      return Promise.resolve(fail("not_found", `No FAA enplanement data for airport code ${input.airport_code}.`));
    }
    return Promise.resolve(ok(record));
  },
});
