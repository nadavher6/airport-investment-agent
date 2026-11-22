// Definition of the get_enplanements tool. Exported only: nothing registers or calls it yet.
import { getEnplanements } from "../../data/enplanements/lookup.ts";
import type { EnplanementResult } from "../../data/enplanements/lookup.ts";

export interface GetEnplanementsInput {
  readonly airport_code: string;
}

export interface NoEnplanementData {
  readonly airport_code: string;
  readonly error: "no_enplanement_data";
}

export interface GetEnplanementsTool {
  readonly name: "get_enplanements";
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: { readonly airport_code: { readonly type: "string"; readonly description: string } };
    readonly required: readonly ["airport_code"];
  };
  /** Tool input is LLM output, so `airport_code` may be missing or not a string; that returns the not-found result. */
  run(input: { readonly airport_code?: unknown }): EnplanementResult | NoEnplanementData;
}

export const getEnplanementsTool: GetEnplanementsTool = {
  name: "get_enplanements",
  description:
    "Official FAA passenger boarding (enplanement) data for a US airport: latest-year total, hub " +
    "classification (Large/Medium/Small/Nonhub), national rank, year-over-year change, compound annual " +
    "growth rates and COVID recovery ratio. Covers CY2015-CY2024. cagr5yr is the 2019->2024 rate " +
    "(5 periods); cagr10yr is the 2015->2024 rate (9 periods, not 10, so it is not a true 10-year CAGR); " +
    "both are in percent. recoveryVs2019 is the 2024/2019 ratio (1 = fully recovered). " +
    "Airports are keyed by 3-letter FAA/IATA code only; 4-letter ICAO codes such as 'KLAX' are not found.",
  parameters: {
    type: "object",
    properties: {
      airport_code: { type: "string", description: "3-letter FAA/IATA code, e.g. 'LAX', 'ATL', 'ORD' (not ICAO like 'KLAX')." },
    },
    required: ["airport_code"],
  },
  run: (input) => {
    const code: unknown = input?.airport_code;
    const result = getEnplanements(code);
    return result ?? { airport_code: typeof code === "string" ? code.trim().toUpperCase() : "", error: "no_enplanement_data" };
  },
};
