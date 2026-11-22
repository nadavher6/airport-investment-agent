// find_airports_by_city, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { findAirportsByCity } from "../../data/places/airports.ts";
import type { CitiesResult } from "../../data/places/airports.ts";
import { defineTool, ok } from "./tool.ts";

const inputSchema = z
  .object({ cities: z.array(z.string().trim().min(1)).min(1, "at least one city is required") })
  .strict();

export type FindAirportsByCityInput = z.infer<typeof inputSchema>;
export type FindAirportsByCityOutput = CitiesResult;

export const findAirportsByCityTool = defineTool<FindAirportsByCityInput, FindAirportsByCityOutput>({
  name: "find_airports_by_city",
  description:
    "Find the airport codes that serve each city or metro area in a list, e.g. ['New York', 'Bay Area'] " +
    "returns JFK, LGA, EWR (+ smaller HPN, ISP) and SFO, OAK, SJC. Matches a curated metro list with aliases " +
    "('NYC', 'DC', 'Twin Cities'), then the FAA city text. Each airport has code, name, city, state, hubType, " +
    "latestEnplanements and secondary (true = a smaller airport serving the metro alongside its main ones), " +
    "sorted by latestEnplanements, highest first. A name with no match returns airports: [] and reason " +
    "'no_match', plus close spellings in suggestions; a suggestion is never used silently, ask or call again.",
  inputSchema,
  exampleInput: { cities: ["Boston", "NYC"] },
  // Per-city 'no_match' (with suggestions) is a legitimate result, not a tool error.
  run: (input) => Promise.resolve(ok(findAirportsByCity(input.cities))),
});
