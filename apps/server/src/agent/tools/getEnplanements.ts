// get_enplanements, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { getEnplanements } from "../../data/enplanements/lookup.ts";
import type { EnplanementResult } from "../../data/enplanements/lookup.ts";
import { defineTool, ok } from "./tool.ts";

/** Returned (as normal output) when a valid code has no enplanement data. */
export interface NoEnplanementData {
  readonly airport_code: string;
  readonly error: "no_enplanement_data";
}

const inputSchema = z
  .object({
    airport_code: z
      .string()
      .trim()
      .min(1, "airport_code is required")
      .transform((code) => code.toUpperCase()),
  })
  .strict();

export type GetEnplanementsInput = z.infer<typeof inputSchema>;
export type GetEnplanementsOutput = EnplanementResult | NoEnplanementData;

export const getEnplanementsTool = defineTool<GetEnplanementsInput, GetEnplanementsOutput>({
  name: "get_enplanements",
  description:
    "Official FAA passenger boarding (enplanement) data for a US airport: latest-year total, hub " +
    "classification (Large/Medium/Small/Nonhub), national rank, year-over-year change, compound annual " +
    "growth rates and COVID recovery ratio. Covers CY2015-CY2024. cagr5yr is the 2019->2024 rate " +
    "(5 periods); cagr10yr is the 2015->2024 rate (9 periods, not 10, so it is not a true 10-year CAGR); " +
    "both are in percent. recoveryVs2019 is the 2024/2019 ratio (1 = fully recovered). " +
    "Airports are keyed by 3-letter FAA/IATA code only; 4-letter ICAO codes such as 'KLAX' are not found.",
  inputSchema,
  exampleInput: { airport_code: "LAX" },
  run: (input) => {
    // airport_code is already trimmed and uppercased by the schema.
    const result = getEnplanements(input.airport_code);
    return Promise.resolve(ok(result ?? { airport_code: input.airport_code, error: "no_enplanement_data" }));
  },
});
