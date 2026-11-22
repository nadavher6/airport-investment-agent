// The per-category tools (#61): get_congestion, get_unmet_demand, get_long_haul_share, get_growth.
// Each one is ONE category of score_airports, on the shared Tool contract. The numbers come from the same
// scorer and the same INVESTMENT_KPIS definitions as the full score: nothing is recomputed here.
import { z } from "zod";
import { findAirport } from "../../data/enplanements/dataset.ts";
import type { AirportRecord } from "../../data/enplanements/types.ts";
import type { KpiEvidence } from "../../scoring/engine.ts";
import { INVESTMENT_KPIS, scoreAirport } from "../../scoring/investmentScore.ts";
import { defineTool, fail, ok, type RegisteredTool } from "./tool.ts";

/** Most distinct codes one category call may take: the same 5 as score_airports in the loop (MAX_SCORED_AIRPORTS). */
export const MAX_CATEGORY_CODES = 5;

/** The four category KPI keys, as in INVESTMENT_KPIS. */
export type CategoryKey = "congestion" | "unmet_demand" | "long_haul" | "growth";

/** "percent": the sub-score does not depend on the other airports; "minmax": scaled against all US airports. */
export type CategoryScale = "percent" | "minmax";

/** One airport's value for the category: the same fields as its score_airports breakdown entry. */
export interface CategoryAirport {
  readonly airportCode: string;
  readonly name: string;
  readonly available: boolean;
  /** The raw KPI value (e.g. load factor %), or null when it can't be computed. */
  readonly raw: number | null;
  /** The 0-100 sub-score, exactly as score_airports computes it; null when unavailable. */
  readonly subScore: number | null;
  readonly evidence: KpiEvidence | null;
}

export interface CategoryOutput {
  readonly category: CategoryKey;
  readonly label: string;
  /** The category's target weight in the full Investment Attractiveness Score. */
  readonly weight: number;
  /** Always "absolute": scored against all US airports, like score_airports with one code. */
  readonly mode: "absolute";
  readonly scale: CategoryScale;
  /** The KPI's assumption / proxy caveat, for the answer. */
  readonly note: string | null;
  /** In the order asked (upper-cased, deduplicated). */
  readonly airports: readonly CategoryAirport[];
  readonly notFound: readonly string[];
}

/** Upper-case, trim, then dedupe (first occurrence wins), as score_airports does. */
const normalizeCodes = (codes: readonly string[]): string[] => [...new Set(codes.map((c) => c.trim().toUpperCase()))];

const inputSchema = z
  .object({
    airport_codes: z
      .array(z.string().trim().min(1))
      .min(1, "at least one airport_code is required")
      .refine((codes) => normalizeCodes(codes).length <= MAX_CATEGORY_CODES, {
        message: `max ${MAX_CATEGORY_CODES} airports; pick the ${MAX_CATEGORY_CODES} most relevant`,
      }),
  })
  .strict();

export type CategoryInput = z.infer<typeof inputSchema>;

/**
 * The scale kind of a KPI definition. Takes `unknown` on purpose: the engine's `Scale` is the string
 * "percent" on main and becomes `{ kind: "percent", fullAt }` with #54 / #57; both read as "percent".
 */
export function scaleKind(scale: unknown): CategoryScale {
  if (scale === "percent") return "percent";
  if (typeof scale === "object" && scale !== null && "kind" in scale && scale.kind === "percent") return "percent";
  return "minmax";
}

/** Build the output for one category from the full (absolute) score of each airport. */
export function categoryOutput(key: CategoryKey, found: readonly AirportRecord[], notFound: readonly string[]): CategoryOutput {
  const def = INVESTMENT_KPIS.find((k) => k.key === key);
  if (def === undefined) throw new Error(`No KPI definition for category ${key}`);
  const airports = found.map((record): CategoryAirport => {
    const kpi = scoreAirport(record).kpis.find((k) => k.key === key);
    return {
      airportCode: record.airportCode,
      name: record.name,
      available: kpi?.available ?? false,
      raw: kpi?.raw ?? null,
      subScore: kpi?.normalized ?? null,
      evidence: kpi?.evidence ?? null,
    };
  });
  return {
    category: key,
    label: def.label,
    weight: def.weight,
    mode: "absolute",
    scale: scaleKind(def.scale),
    note: def.note ?? null,
    airports,
    notFound,
  };
}

const SHARED_DESCRIPTION =
  "Returns ONLY this category for 1-5 airports: per airport the raw value, the 0-100 sub-score, and the evidence " +
  "(formula, inputs, explanation), plus the category's weight in the full score and its caveat (`note`). The numbers " +
  "are exactly score_airports' sub-scores for this category, scored against all US airports (mode absolute). " +
  "Use it when the question is about this one category, not about overall investment potential or a ranking " +
  `(those need score_airports). Codes are case-insensitive and deduplicated; at most ${MAX_CATEGORY_CODES}. Unknown ` +
  "codes are returned in `notFound`; `available: false` means the category has no data for that airport.";

function categoryTool(name: string, key: CategoryKey, what: string): RegisteredTool {
  return defineTool<CategoryInput, CategoryOutput>({
    name,
    description: `${what} ${SHARED_DESCRIPTION}`,
    inputSchema,
    exampleInput: { airport_codes: ["LAX", "SNA"] },
    run: (input) => {
      const codes = normalizeCodes(input.airport_codes);
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
      return Promise.resolve(ok(categoryOutput(key, found, notFound)));
    },
  });
}

export const getCongestionTool = categoryTool(
  "get_congestion",
  "congestion",
  "The congestion / capacity-pressure category of the Investment Attractiveness Score (how full or busy an airport is).",
);

export const getUnmetDemandTool = categoryTool(
  "get_unmet_demand",
  "unmet_demand",
  "The unmet-demand category (load factor = passengers ÷ seats; how full the planes are, a proxy for turned-away passengers).",
);

export const getLongHaulShareTool = categoryTool(
  "get_long_haul_share",
  "long_haul",
  "The long-haul category (international share = international seats ÷ total seats).",
);

export const getGrowthTool = categoryTool(
  "get_growth",
  "growth",
  "The growth / durability category (5-year enplanement CAGR, % per year; is traffic growing).",
);

/** The four category tools, in the scoring order. */
export const CATEGORY_TOOLS: readonly RegisteredTool[] = [getCongestionTool, getUnmetDemandTool, getLongHaulShareTool, getGrowthTool];
