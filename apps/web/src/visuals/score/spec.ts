// zod/mini, as in #33's spec.ts: the same validator with a tree-shakable API.
import { z } from "zod/mini";

/**
 * The `score_airports` tool_result output (#41). The shape is copied from the issue, which
 * copies it from PR #38 (`apps/server/src/agent/tools/scoreAirports.ts` and the
 * `KpiEvidence` type in `apps/server/src/scoring/engine.ts`). Nothing is imported from #38:
 * the web checks the output itself, and anything that does not match goes to the generic
 * JSON tool view.
 */
export const SCORE_TOOL = "score_airports";

/** The four categories, in the order the report, the compare rows and the table columns use. */
export const CATEGORIES = ["congestion", "unmet_demand", "long_haul", "growth"] as const;
export type CategoryKey = (typeof CATEGORIES)[number];

/** The agent caps a request at 5 airports; more than that shows the top 5 and a "+N more" note. */
export const MAX_SHOWN = 5;

const finite = z.number({ error: "must be a finite number" });
const score100 = finite.check(z.gte(0), z.lte(100));
const nullable = <T extends z.core.SomeType>(t: T) => z.union([t, z.null()]);

/** #38 KpiEvidence: inputs are named numbers or strings, null when the source has no record. */
export const evidence = z.object({
  formula: z.string(),
  inputs: z.record(z.string(), z.union([finite, z.string(), z.null()])),
  value: nullable(finite),
  explanation: z.string(),
});

const category = z.object({
  label: z.string().check(z.minLength(1)),
  weight: finite.check(z.gte(0), z.lte(1)),
  available: z.boolean(),
  subScore: nullable(score100),
  contribution: nullable(score100),
  evidence: z.optional(evidence),
});

const breakdown = z.object({
  congestion: category,
  unmet_demand: category,
  long_haul: category,
  growth: category,
});

const ranked = z.object({
  airportCode: z.string().check(z.minLength(1)),
  name: z.string(),
  score: score100,
  coverage: finite.check(z.gte(0), z.lte(1)),
  missing: z.array(z.string()),
  breakdown,
});

// #75: no `mode` any more (every score is a fixed scale); an older output that still has one parses (unknown keys are stripped).
export const scoreResult = z.object({
  // 0 airports is not a case the issue covers (#38 returns an error then): the generic view shows it.
  ranking: z.array(ranked).check(z.minLength(1)),
  notFound: z.array(z.string()),
});

export type ScoreResult = z.infer<typeof scoreResult>;
export type RankedAirport = z.infer<typeof ranked>;
export type Category = z.infer<typeof category>;
export type Evidence = z.infer<typeof evidence>;

export type ScoreParseResult = { ok: true; result: ScoreResult } | { ok: false; reason: string };

/** Checks a tool output against the score shape. Never throws. */
export function parseScoreResult(output: unknown): ScoreParseResult {
  const parsed = z.safeParse(scoreResult, output);
  if (parsed.success) return { ok: true, result: parsed.data };
  const first = parsed.error.issues[0];
  const where = first && first.path.length > 0 ? first.path.join(".") : "output";
  return { ok: false, reason: `${where}: ${first?.message ?? "not a score result"}` };
}

/**
 * Highest final score first. The sort is stable, so ties keep the tool's own order
 * (the issue does not say how to break a tie). Copies; never changes the input.
 */
export function sortByScore(ranking: readonly RankedAirport[]): RankedAirport[] {
  return [...ranking].sort((a, b) => b.score - a.score);
}

/** How every score reads (#75): a fixed scale on the airport's own numbers, the same alone or in any comparison. */
export const SCALE_TEXT = "Fixed scales on each airport's own numbers";

const oneDecimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

/** A 0-100 score with at most 1 decimal: 72.4 -> "72.4", 100 -> "100". */
export const formatScore = (value: number): string => oneDecimal.format(value);

/** A 0-1 share as a percent with at most 1 decimal: 0.75 -> "75%". */
export const formatShare = (value: number): string => `${oneDecimal.format(value * 100)}%`;

/** What a missing category needs, from its evidence: "Not computed — needs <formula>". */
export function missingText(cat: Category): string {
  const need = cat.evidence?.formula.trim();
  return `Not computed — needs ${need ? need : "data that is not available"}`;
}
