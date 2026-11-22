// zod/mini, as the score view's spec.ts.
import { z } from "zod/mini";
import { formatFull } from "../format";
import { CATEGORIES, evidence, type Category } from "./spec";

/**
 * The per-category tool_result outputs (#61): get_congestion, get_unmet_demand, get_long_haul_share
 * and get_growth (`apps/server/src/agent/tools/categoryTools.ts`). Like the score view, nothing is
 * imported from the server: the web checks the output itself, and anything that does not match goes
 * to the generic JSON tool card.
 */
export const CATEGORY_TOOLS = ["get_congestion", "get_unmet_demand", "get_long_haul_share", "get_growth"] as const;

/** Whether a tool name is one of the four category tools. */
export const isCategoryTool = (name: string): boolean => (CATEGORY_TOOLS as readonly string[]).includes(name);

const finite = z.number({ error: "must be a finite number" });
const score100 = finite.check(z.gte(0), z.lte(100));
const nullable = <T extends z.core.SomeType>(t: T) => z.union([t, z.null()]);

/** get_growth's per-airport extras (#67): the yearly series (null = no FAA figure that year) and trend facts. */
const growthFacts = z.object({
  series: z
    .array(z.object({ year: z.int(), enplanements: nullable(finite.check(z.gte(0))) }))
    .check(
      z.minLength(1),
      z.refine((pts) => new Set(pts.map((p) => p.year)).size === pts.length, { error: "has duplicate years" }),
    ),
  cagr5yr: nullable(finite),
  cagr10yr: nullable(finite),
  cagr10yrPeriods: z.optional(finite),
  recoveryVs2019: nullable(finite),
  latest: z.object({ year: z.int(), enplanements: finite, yoyChangePct: nullable(finite) }),
  covid2020: z.object({ enplanements: nullable(finite), pctVs2019: nullable(finite) }),
  peak: nullable(z.object({ year: z.int(), enplanements: finite })),
});

const airport = z.object({
  airportCode: z.string().check(z.minLength(1)),
  name: z.string(),
  available: z.boolean(),
  raw: nullable(finite),
  subScore: nullable(score100),
  evidence: nullable(evidence),
  // Only get_growth sends it (#67); a malformed one fails the whole check, so the generic card shows the JSON.
  growth: z.optional(growthFacts),
});

export const categoryResult = z.object({
  category: z.enum(CATEGORIES),
  label: z.string().check(z.minLength(1)),
  weight: finite.check(z.gte(0), z.lte(1)),
  // #75: no `mode`; every category is a fixed scale, "percent" (share ÷ fullAt) or "linear" (growth: 50 + 5 × CAGR).
  scale: z.optional(z.enum(["percent", "linear"])),
  // The unit of every airport's raw value ("%", "% per year", "departures/yr"); absent in older outputs.
  unit: z.optional(z.string()),
  note: z.optional(nullable(z.string())),
  // The tool returns an error, not an empty list, when no code is found: the generic card shows anything else.
  airports: z.array(airport).check(z.minLength(1)),
  notFound: z.array(z.string()),
});

export type CategoryResult = z.infer<typeof categoryResult>;
export type CategoryAirport = z.infer<typeof airport>;
export type GrowthFacts = z.infer<typeof growthFacts>;
export type GrowthAirport = CategoryAirport & { growth: GrowthFacts };

/** The growth view needs every airport's series; an older get_growth output without it keeps the plain category view. */
export const growthAirports = (result: CategoryResult): GrowthAirport[] | null =>
  result.category === "growth" && result.airports.every((a): a is GrowthAirport => a.growth !== undefined)
    ? (result.airports as GrowthAirport[])
    : null;

export type CategoryParseResult = { ok: true; result: CategoryResult } | { ok: false; reason: string };

/** Checks a tool output against the category shape. Never throws. */
export function parseCategoryResult(output: unknown): CategoryParseResult {
  const parsed = z.safeParse(categoryResult, output);
  if (parsed.success) return { ok: true, result: parsed.data };
  const first = parsed.error.issues[0];
  const where = first && first.path.length > 0 ? first.path.join(".") : "output";
  return { ok: false, reason: `${where}: ${first?.message ?? "not a category result"}` };
}

/** A computed airport: the tool says available and a sub-score is there. */
export const isScored = (a: CategoryAirport): a is CategoryAirport & { subScore: number } => a.available && a.subScore !== null;

/**
 * Highest sub-score first; airports without one go last. Stable, so ties keep the tool's order.
 * Copies; never changes the input.
 */
export function sortBySubScore(airports: readonly CategoryAirport[]): CategoryAirport[] {
  const key = (a: CategoryAirport): number => (isScored(a) ? a.subScore : -1);
  return [...airports].sort((a, b) => key(b) - key(a));
}

/** The raw value as the full number (up to 2 decimals) with its unit: 30.8 + "%" -> "30.8%", 266820 + "departures/yr" -> "266,820 departures/yr"; missing -> "—". */
export const formatRaw = (raw: number | null, unit?: string): string => {
  if (raw === null) return "—";
  const n = formatFull(raw);
  if (unit === undefined || unit === "") return n;
  // "30.8%", "6.2% per year" stay attached to the number; word units get a space: "266,820 departures/yr".
  return unit.startsWith("%") ? `${n}${unit}` : `${n} ${unit}`;
};

/** One airport as a score-view `Category`, so the shared CategoryDetail can draw it (no contribution here). */
export const asCategory = (result: CategoryResult, a: CategoryAirport): Category => ({
  label: result.label,
  weight: result.weight,
  available: a.available,
  subScore: a.subScore,
  contribution: null,
  ...(a.evidence ? { evidence: a.evidence } : {}),
});
