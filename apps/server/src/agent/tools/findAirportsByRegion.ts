// find_airports_by_region, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { findAirportsByRegion } from "../../data/places/airports.ts";
import type { RegionResult } from "../../data/places/airports.ts";
import { defineTool, ok } from "./tool.ts";

const inputSchema = z.object({ region: z.string().trim().min(1, "region is required") }).strict();

export type FindAirportsByRegionInput = z.infer<typeof inputSchema>;
export type FindAirportsByRegionOutput = RegionResult;

export const findAirportsByRegionTool = defineTool<FindAirportsByRegionInput, FindAirportsByRegionOutput>({
  name: "find_airports_by_region",
  description:
    "Find the airports in an informal US region: West Coast, East Coast, New England, Midwest, Pacific " +
    "Northwest, Southwest, Southeast, Mountain West or Gulf Coast (aliases accepted). It resolves the region " +
    "to its list of cities, then returns { region, matchedAs, cities, results } where results is exactly what " +
    "find_airports_by_city returns for that list. An unknown region returns reason 'no_match' with empty " +
    "cities and results, and suggestions when a name is close. States are not supported.",
  inputSchema,
  exampleInput: { region: "West Coast" },
  // An unknown region is a legitimate 'no_match' result, not a tool error.
  run: (input) => Promise.resolve(ok(findAirportsByRegion(input.region))),
});
