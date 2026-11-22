// score_airports, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { findAirport } from "../../data/enplanements/dataset.ts";
import { rankAirports } from "../../scoring/investmentScore.ts";
import { defineTool, fail, ok } from "./tool.ts";

const inputSchema = z
  .object({ airport_codes: z.array(z.string().trim().min(1)).min(1, "at least one airport_code is required") })
  .strict();

export type ScoreAirportsInput = z.infer<typeof inputSchema>;

export const scoreAirportsTool = defineTool<ScoreAirportsInput, unknown>({
  name: "score_airports",
  description:
    "Rank US airports by the deterministic Investment Attractiveness Score (0-100): a weighted blend of " +
    "congestion, unmet demand, long-haul share and growth. v0 computes growth (enplanement CAGR) and an " +
    "unmet-demand proxy (demand magnitude) from FAA data; congestion and long-haul are pending BTS T-100 " +
    "data, so each result reports `coverage` (0.50 in v0) and `missing`, plus a per-KPI breakdown so the " +
    "ranking can be explained. Unknown codes are returned in `notFound`, not scored.",
  inputSchema,
  exampleInput: { airport_codes: ["LAX", "SFO", "DEN"] },
  run: (input) => {
    const codes = input.airport_codes.map((c) => c.toUpperCase());
    const found = codes.map((c) => findAirport(c)).filter((r): r is NonNullable<typeof r> => r !== null);
    const notFound = codes.filter((c) => findAirport(c) === null);
    if (found.length === 0) {
      return Promise.resolve(fail("not_found", `None of the airport codes were found: ${codes.join(", ")}.`));
    }
    const ranking = rankAirports(found).map((s) => ({
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
    return Promise.resolve(ok({ ranking, notFound }));
  },
});
