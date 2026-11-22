// Definition of the find_airports_by_city tool. Exported only: nothing registers or calls it yet.
import { findAirportsByCity } from "../../data/places/airports.ts";
import type { CitiesResult } from "../../data/places/airports.ts";

export interface FindAirportsByCityTool {
  readonly name: "find_airports_by_city";
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: {
      readonly cities: {
        readonly type: "array";
        readonly items: { readonly type: "string" };
        readonly description: string;
      };
    };
    readonly required: readonly ["cities"];
  };
  /** Tool input is LLM output, so `cities` may be missing or malformed; that returns an empty result. */
  run(input: { readonly cities?: unknown }): CitiesResult;
}

export const findAirportsByCityTool: FindAirportsByCityTool = {
  name: "find_airports_by_city",
  description:
    "Find the airport codes that serve each city or metro area in a list, e.g. ['New York', 'Bay Area'] " +
    "returns JFK, LGA, EWR (+ smaller HPN, ISP) and SFO, OAK, SJC. Matches a curated metro list with aliases " +
    "('NYC', 'DC', 'Twin Cities'), then the FAA city text. Each airport has code, name, city, state, hubType, " +
    "latestEnplanements and secondary (true = a smaller airport serving the metro alongside its main ones), " +
    "sorted by latestEnplanements, highest first. A name with no match returns airports: [] and reason " +
    "'no_match', plus close spellings in suggestions; a suggestion is never used silently, ask or call again.",
  parameters: {
    type: "object",
    properties: {
      cities: { type: "array", items: { type: "string" }, description: "City or metro names, e.g. ['Boston', 'NYC']." },
    },
    required: ["cities"],
  },
  run: (input) => findAirportsByCity(input?.cities),
};
