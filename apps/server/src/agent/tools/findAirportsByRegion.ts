// Definition of the find_airports_by_region tool. Exported only: nothing registers or calls it yet.
import { findAirportsByRegion } from "../../data/places/airports.ts";
import type { RegionResult } from "../../data/places/airports.ts";

export interface FindAirportsByRegionTool {
  readonly name: "find_airports_by_region";
  readonly description: string;
  readonly parameters: {
    readonly type: "object";
    readonly properties: { readonly region: { readonly type: "string"; readonly description: string } };
    readonly required: readonly ["region"];
  };
  /** Tool input is LLM output, so `region` may be missing or not a string; that returns the no_match result. */
  run(input: { readonly region?: unknown }): RegionResult;
}

export const findAirportsByRegionTool: FindAirportsByRegionTool = {
  name: "find_airports_by_region",
  description:
    "Find the airports in an informal US region: West Coast, East Coast, New England, Midwest, Pacific " +
    "Northwest, Southwest, Southeast, Mountain West or Gulf Coast (aliases accepted). It resolves the region " +
    "to its list of cities, then returns { region, matchedAs, cities, results } where results is exactly what " +
    "find_airports_by_city returns for that list. An unknown region returns reason 'no_match' with empty " +
    "cities and results, and suggestions when a name is close. States are not supported.",
  parameters: {
    type: "object",
    properties: { region: { type: "string", description: "Region name, e.g. 'West Coast' or 'New England'." } },
    required: ["region"],
  },
  run: (input) => findAirportsByRegion(input?.region),
};
