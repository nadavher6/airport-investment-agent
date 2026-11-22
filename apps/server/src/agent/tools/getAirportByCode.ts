// Definition of the get_airport_by_code tool. Exported only: nothing registers or calls it yet.
import { getAirportByCode } from "../../data/places/airports.ts";
import type { AirportSummary, NotFound } from "../../data/places/airports.ts";

export interface GetAirportByCodeTool {
  readonly name: "get_airport_by_code";
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: { readonly code: { readonly type: "string"; readonly description: string } };
    readonly required: readonly ["code"];
  };
  /** Tool input is LLM output, so `code` may be missing or not a string; that returns not_found. */
  run(input: { readonly code?: unknown }): AirportSummary | NotFound;
}

export const getAirportByCodeTool: GetAirportByCodeTool = {
  name: "get_airport_by_code",
  description:
    "Look up one US airport by its 3-letter FAA/IATA code (case-insensitive) in the FAA enplanement data. " +
    "Returns code, name, city, state, hubType (L/M/S/N, null for non-primary airports) and " +
    "latestEnplanements (latest calendar year). An unknown code returns { error: 'not_found' }. " +
    "To find which airports serve a place, use find_airports_by_city or find_airports_by_region instead.",
  parameters: {
    type: "object",
    properties: { code: { type: "string", description: "3-letter FAA/IATA code, e.g. 'JFK'." } },
    required: ["code"],
  },
  run: (input) => getAirportByCode(input?.code),
};
