// get_airport_by_code, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { getAirportByCode } from "../../data/places/airports.ts";
import type { AirportSummary, NotFound } from "../../data/places/airports.ts";
import { defineTool, ok } from "./tool.ts";

const inputSchema = z.object({ code: z.string().trim().min(1, "code is required") }).strict();

export type GetAirportByCodeInput = z.infer<typeof inputSchema>;
export type GetAirportByCodeOutput = AirportSummary | NotFound;

export const getAirportByCodeTool = defineTool<GetAirportByCodeInput, GetAirportByCodeOutput>({
  name: "get_airport_by_code",
  description:
    "Look up one US airport by its 3-letter FAA/IATA code (case-insensitive) in the FAA enplanement data. " +
    "Returns code, name, city, state, hubType (L/M/S/N, null for non-primary airports) and " +
    "latestEnplanements (latest calendar year). An unknown code returns { error: 'not_found' }. " +
    "To find which airports serve a place, use find_airports_by_city or find_airports_by_region instead.",
  inputSchema,
  exampleInput: { code: "JFK" },
  // An unknown code is a legitimate result (NotFound), not a tool error.
  run: (input) => Promise.resolve(ok(getAirportByCode(input.code))),
});
