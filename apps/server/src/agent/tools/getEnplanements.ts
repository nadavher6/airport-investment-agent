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
  run(input: GetEnplanementsInput): EnplanementResult | NoEnplanementData;
}

export const getEnplanementsTool: GetEnplanementsTool = {
  name: "get_enplanements",
  description:
    "Official FAA passenger boarding (enplanement) data for a US airport: latest-year total, hub " +
    "classification (Large/Medium/Small/Nonhub), national rank, year-over-year change, 5- and 10-year " +
    "CAGR, and COVID recovery ratio. Covers CY2015-CY2024.",
  parameters: {
    type: "object",
    properties: {
      airport_code: { type: "string", description: "3-letter IATA/FAA code, e.g. 'LAX', 'ATL', 'ORD'." },
    },
    required: ["airport_code"],
  },
  run: ({ airport_code }) => {
    const result = getEnplanements(airport_code);
    return result ?? { airport_code: airport_code.trim().toUpperCase(), error: "no_enplanement_data" };
  },
};
