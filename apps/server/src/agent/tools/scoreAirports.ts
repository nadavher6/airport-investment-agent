// score_airports, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { findAirport } from "../../data/enplanements/dataset.ts";
import { rankAirports, rankAirportsRelative } from "../../scoring/investmentScore.ts";
import { defineTool, fail, ok } from "./tool.ts";

const inputSchema = z
  .object({ airport_codes: z.array(z.string().trim().min(1)).min(1, "at least one airport_code is required") })
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
    "unknown codes are returned in `notFound`.",
  inputSchema,
  exampleInput: { airport_codes: ["LAX", "SFO", "DEN"] },
  run: (input) => {
    const codes = input.airport_codes.map((c) => c.toUpperCase());
    const found = codes.map((c) => findAirport(c)).filter((r): r is NonNullable<typeof r> => r !== null);
    const notFound = codes.filter((c) => findAirport(c) === null);
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
      coverage: s.coverage, // share of the model actually computed (0.50 in v0)
      missing: s.missing, // categories not yet computed
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
