// score_airports, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { findAirport } from "../../data/enplanements/dataset.ts";
import type { AirportRecord } from "../../data/enplanements/types.ts";
import { rankAirports, rankAirportsRelative } from "../../scoring/investmentScore.ts";
import { defineTool, fail, ok } from "./tool.ts";

/** Most codes one call may score; more is almost surely a mistake, and the output would be huge. */
export const MAX_AIRPORT_CODES = 50;

const inputSchema = z
  .object({
    airport_codes: z
      .array(z.string().trim().min(1))
      .min(1, "at least one airport_code is required")
      .max(MAX_AIRPORT_CODES, `at most ${MAX_AIRPORT_CODES} airport_codes per call`),
  })
  .strict();

export type ScoreAirportsInput = z.infer<typeof inputSchema>;

export const scoreAirportsTool = defineTool<ScoreAirportsInput, unknown>({
  name: "score_airports",
  description:
    "Rank US airports by the deterministic Investment Attractiveness Score (0-100): a weighted blend of " +
    "congestion (operations), unmet demand (load factor), long-haul share (international seats) and growth " +
    "(enplanement CAGR), from FAA + BTS T-100 data. With 2+ codes it ranks them RELATIVE to each other " +
    "(score 100 = best of the compared set); with 1 code it scores ABSOLUTELY vs all US airports. Each " +
    "result gives the final score, a per-category subScore + contribution, and evidence (formula, inputs, " +
    "explanation) so the ranking can be explained. `coverage`/`missing` flag any category without data; " +
    "unknown codes are returned in `notFound`. Codes are case-insensitive and deduplicated; at most " +
    `${MAX_AIRPORT_CODES} per call. Equal scores are ordered by airport code.`,
  inputSchema,
  exampleInput: { airport_codes: ["LAX", "SFO", "DEN"] },
  run: (input) => {
    // Upper-case, then dedupe (first occurrence wins), so "LAX" and "lax" are one airport.
    const codes = [...new Set(input.airport_codes.map((c) => c.toUpperCase()))];
    const found: AirportRecord[] = [];
    const notFound: string[] = [];
    for (const code of codes) {
      const record = findAirport(code);
      if (record === null) notFound.push(code);
      else found.push(record);
    }
    if (found.length === 0) {
      return Promise.resolve(fail("not_found", `None of the airport codes were found: ${codes.join(", ")}.`));
    }
    // 2+ airports: rank relative to each other (differentiates). 1 airport: absolute vs all US airports.
    const mode = found.length >= 2 ? "relative" : "absolute";
    const scored = mode === "relative" ? rankAirportsRelative(found) : rankAirports(found);
    const ranking = scored.map((s) => ({
      airportCode: s.item.airportCode,
      name: s.item.name,
      score: s.score, // final 0-100
      coverage: s.coverage, // share of the model's weight actually computed (1 = all four KPIs)
      missing: s.missing, // categories without data for this airport
      breakdown: Object.fromEntries(
        s.kpis.map((k) => [
          k.key,
          {
            label: k.label,
            weight: k.weight, // target weight in the full model
            available: k.available,
            subScore: k.normalized, // 0-100 sub-score for this category
            contribution: k.contribution, // points this sub-score added to the final score (subScore × renormalized weight)
            evidence: k.evidence, // { formula, inputs, value, explanation }
          },
        ]),
      ),
    }));
    return Promise.resolve(ok({ mode, ranking, notFound }));
  },
});
