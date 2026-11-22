// The per-category tools (#61): get_congestion, get_unmet_demand, get_long_haul_share, get_growth.
// Each one is ONE category of score_airports, on the shared Tool contract. The numbers come from the same
// scorer and the same INVESTMENT_KPIS definitions as the full score: nothing is recomputed here.
import { z } from "zod";
import { enplanementsDataset, findAirport } from "../../data/enplanements/dataset.ts";
import type { AirportRecord } from "../../data/enplanements/types.ts";
import type { KpiEvidence } from "../../scoring/engine.ts";
import { INVESTMENT_KPIS, scoreAirport } from "../../scoring/investmentScore.ts";
import { growthFacts, type GrowthFacts } from "./growth.ts";
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
  /** The 0-100 sub-score on the absolute scale (as score_airports with one code); null when unavailable. */
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
  /** The unit of every airport's `raw` value, e.g. "%" or "departures/yr", so the answer and the UI can show it. */
  readonly unit: string;
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

/**
 * The unit of each category's raw value. KpiDef has no unit field, and the raw units are fixed by the KPI
 * definitions' own formulas (load factor %, international share %, CAGR % per year). Congestion is runway utilization
 * in percent (#54).
 */
export const CATEGORY_UNITS: Readonly<Record<CategoryKey, string>> = {
  congestion: "%",
  unmet_demand: "%",
  long_haul: "%",
  growth: "% per year",
};

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
    unit: CATEGORY_UNITS[key],
    note: def.note ?? null,
    airports,
    notFound,
  };
}

/** get_growth's airport: the category fields plus the yearly series and trend facts (#67). */
export interface GrowthAirport extends CategoryAirport {
  readonly growth: GrowthFacts;
}

/** get_growth's output: the growth category plus, per airport, the CY2015-CY2024 series and trend facts (#67). */
export interface GrowthOutput extends CategoryOutput {
  readonly category: "growth";
  /** The dataset's years (meta.years), the x axis of every airport's series. */
  readonly years: readonly number[];
  readonly airports: readonly GrowthAirport[];
}

/** The growth category output with each airport's series and trend facts added (same order as `found`). */
export function growthOutput(found: readonly AirportRecord[], notFound: readonly string[]): GrowthOutput {
  const base = categoryOutput("growth", found, notFound);
  const years = [...enplanementsDataset.meta.years].sort((a, b) => a - b);
  return {
    ...base,
    category: "growth",
    years,
    airports: base.airports.map((a, i): GrowthAirport => ({ ...a, growth: growthFacts(found[i]!, years) })),
  };
}

const SHARED_DESCRIPTION =
  "Returns ONLY this category for 1-5 airports: per airport the raw value (in `unit`), the 0-100 sub-score, and the " +
  "evidence (formula, inputs, explanation), plus the category's weight in the full score and its caveat (`note`). " +
  "This tool is always ABSOLUTE: every airport is scored against all US airports, so a min-max category (growth) can " +
  "differ from score_airports with 2+ codes, which rescales it relative to the compared set (e.g. growth LAX 44.1 here " +
  "but 0 there); it equals score_airports with ONE code. The percent-scale categories (unmet demand, long-haul) are " +
  "the same in both modes. Do not put the two side by side as if they were the same number. " +
  "Use it when the question is about this one category, not about overall investment potential or a ranking " +
  `(those need score_airports). Codes are case-insensitive and deduplicated; at most ${MAX_CATEGORY_CODES}. Unknown ` +
  "codes are returned in `notFound`; `available: false` means the category has no data for that airport.";

function categoryTool(
  name: string,
  key: CategoryKey,
  what: string,
  build: (found: readonly AirportRecord[], notFound: readonly string[]) => CategoryOutput = (found, notFound) =>
    categoryOutput(key, found, notFound),
): RegisteredTool {
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
      return Promise.resolve(ok(build(found, notFound)));
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
  "The long-haul category (international share = international seats ÷ total seats). Per airport the evidence inputs " +
    "ALSO give the number of international flights (`internationalDepartures` = T-100 departures − domestic departures, " +
    "out of `departures`) and `internationalPassengers`; null = not in the data, never 0. They are shown, not scored: " +
    "the sub-score stays on the seat share. T-100 international = a segment to a foreign airport, so it does not " +
    "separate long-haul from short-haul international.",
);

export const getGrowthTool = categoryTool(
  "get_growth",
  "growth",
  "The growth / durability category (5-year enplanement CAGR, % per year; is traffic growing). Use it for growth / " +
    "trend / traffic-over-time questions. Per airport it ALSO returns `growth`: the CY2015-CY2024 enplanement " +
    "`series` (one entry per year; null = no FAA figure that year, never filled in), cagr5yr (2019->2024), cagr10yr " +
    "(2015->2024, 9 periods, not 10), recoveryVs2019 (latest ÷ 2019, 1 = fully recovered), the latest year with its " +
    "YoY %, the 2020 COVID low (value and % vs 2019) and the peak year. The UI draws the series as a line chart, so " +
    "explain the trend in words; do not retype the yearly numbers.",
  growthOutput,
);

/** The four category tools, in the scoring order. */
export const CATEGORY_TOOLS: readonly RegisteredTool[] = [getCongestionTool, getUnmetDemandTool, getLongHaulShareTool, getGrowthTool];
