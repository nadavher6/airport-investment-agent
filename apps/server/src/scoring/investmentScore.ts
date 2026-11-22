/**
 * Airport Investment Attractiveness Score (tasks/06-scoring-formula-research.md).
 *
 * Full model = Need 0.60 (congestion + unmet demand) / Quality 0.40 (long-haul + growth):
 * - congestion   — runway utilization = operations (BTS T-100 (latest 12 months) departures × 2) ÷ ASV
 *                  (FAA AC 150/5060-5 Figure 2-1, from the FAA NASR runway layout), in percent; sub-score = the
 *                  percentage itself (scale percent, fullAt 1.0, capped at 100)
 * - unmet_demand — load factor = passengers ÷ seats (BTS T-100 (latest 12 months)), proxy for spilled demand;
 *                  its sub-score is the load factor percentage itself (scale percent, fullAt 1.0, capped at 100)
 * - long_haul    — international seats ÷ total seats (BTS T-100 (latest 12 months));
 *                  its sub-score is that share ÷ 50% × 100, capped at 100 (scale percent, fullAt 0.5)
 * - growth       — enplanement 5-year CAGR, CY2019 -> CY2024, % per year (FAA data); missing if no CAGR
 *
 * All four are computed, so an airport present in both datasets reports coverage = 1.0.
 * An airport missing from a source yields null for that KPI; the engine renormalizes weights
 * over the available KPIs and reports `coverage` + `missing`, so partial data stays honest.
 */
import { enplanementsDataset } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { getCapacity } from "../data/capacity/dataset.ts";
import type { CapacityAirport } from "../data/capacity/types.ts";
import { getT100 } from "../data/t100/dataset.ts";
import { buildScorer, percentScore, type KpiDef, type Scale, type ScoredItem } from "./engine.ts";

/**
 * The growth KPI in its one unit: percent per year (5-year CAGR). Airports without a CAGR get null
 * (missing), not the recovery ratio, which is a total change over a different, often zero-year span.
 */
export function growthPctPerYear(a: AirportRecord): number | null {
  return a.trend.cagr5yr;
}

/** FAA rule of thumb for runway utilization (operations ÷ ASV): start planning at 60%, start building at 80%. */
export const FAA_PLANNING_TRIGGER_PCT = 60;
export const FAA_CONSTRUCTION_TRIGGER_PCT = 80;

/**
 * The congestion KPI's scale (#57's shape): the raw value is the utilization in percent points, as for the other
 * percent KPIs, and fullAt 1.0 (100% of the ASV, as a fraction) earns the full 100 points: 86.8% scores 86.8,
 * 205% scores 100.
 */
export const CONGESTION_SCALE: Extract<Scale, { kind: "percent" }> = { kind: "percent", fullAt: 1.0 };

/**
 * Runway utilization as a ratio, 4 decimals: operations ÷ ASV (1.0 = at capacity). Not capped here (the
 * percent scale caps the sub-score at 100), so the raw value stays the honest ratio. null when either input
 * is missing or not a usable number: never estimated.
 */
export function utilizationRatio(operations: number | null, asv: number | null): number | null {
  if (operations === null || asv === null || !Number.isFinite(operations) || !Number.isFinite(asv)) return null;
  if (asv <= 0 || operations < 0) return null;
  return Math.round((operations / asv) * 10_000) / 10_000;
}

/** A ratio in percent points, one decimal (0.868 -> 86.8, 2.05 -> 205), uncapped. */
export const ratioToPct = (ratio: number): number => Math.round(ratio * 100 * 10) / 10;

export interface RunwayUtilization {
  /** BTS T-100 departures × 2 (arrivals ≈ departures), latest 12 months. */
  readonly operations: number;
  readonly asv: number;
  /** operations ÷ ASV, 4 decimals (1.0 = at capacity). */
  readonly ratio: number;
  /** The ratio in percent points, one decimal, uncapped: the KPI's raw value (the engine divides it by 100). */
  readonly utilizationPct: number;
}

/** The congestion KPI's inputs for one airport, or null when the T-100 record or the ASV is missing. */
export function runwayUtilization(code: string): RunwayUtilization | null {
  const departures = getT100(code)?.departures ?? null;
  const asv = getCapacity(code)?.configuration?.asv ?? null;
  const operations = departures === null ? null : departures * 2;
  const ratio = utilizationRatio(operations, asv);
  if (ratio === null || operations === null || asv === null) return null;
  return { operations, asv, ratio, utilizationPct: ratioToPct(ratio) };
}

const fmt = (n: number): string => n.toLocaleString("en-US");

/** Where a utilization sits against the FAA's 60% / 80% triggers, in words. */
export function triggerPhrase(pct: number): string {
  if (pct >= FAA_CONSTRUCTION_TRIGGER_PCT) return "past the FAA's 80% trigger to start building more capacity";
  if (pct >= FAA_PLANNING_TRIGGER_PCT) return "past the FAA's 60% planning trigger";
  return "below the FAA's 60% planning trigger";
}

/** The congestion evidence sentence, with the real numbers, or why it is missing. */
function utilizationSentence(departures: number | null, c: CapacityAirport | null, u: RunwayUtilization | null): string {
  if (departures === null) return "No BTS T-100 record for this airport, so its annual operations are unknown and congestion is missing.";
  const cfg = c?.configuration ?? null;
  if (cfg === null || u === null) {
    return `No runway capacity estimate: ${c?.missingReason ?? "the airport is not in the FAA runway data"}, so congestion is missing.`;
  }
  const cap = u.utilizationPct > 100 ? " The sub-score is capped at 100." : "";
  const more =
    c !== null && c.layoutRunways > cfg.runwaysUsed
      ? ` The airport has ${c.layoutRunways} runways but the closest Figure 2-1 configuration has ${cfg.runwaysUsed}, so the ASV is likely understated and the utilization overstated.`
      : "";
  return (
    `${fmt(u.operations)} operations a year (${fmt(departures)} T-100 departures × 2) against an estimated ` +
    `${fmt(cfg.asv)} (FAA AC 150/5060-5 Figure 2-1 configuration ${cfg.figure21No}, ${cfg.label}): ` +
    `at ${u.utilizationPct}% of its estimated capacity, ${triggerPhrase(u.utilizationPct)}.${cap}${more} ` +
    "General-aviation and military flights are not in T-100, so on that side the real figure is higher."
  );
}

/** Ties in the ranking are ordered by airport code, ascending. */
const byAirportCode = (a: AirportRecord): string => a.airportCode;

export const INVESTMENT_KPIS: readonly KpiDef<AirportRecord>[] = [
  {
    key: "congestion",
    label: "Congestion: runway utilization",
    weight: 0.3,
    direction: "higher",
    scale: CONGESTION_SCALE,
    note: "Runway utilization = annual operations ÷ Annual Service Volume (ASV), in percent (100% = at capacity). Operations = BTS T-100 (latest 12 months) departures × 2 (arrivals ≈ departures); ASV = FAA AC 150/5060-5 Figure 2-1 midpoint for the airport's runway configuration (FAA NASR runways, data/capacity.json). Sub-score = the utilization percentage (86.8% scores 86.8), capped at 100. T-100 has no general-aviation or military flights, so this is a lower bound; the ASV is a long-range planning estimate. FAA rule of thumb: plan more capacity at 60%, build at 80%.",
    extract: (a) => runwayUtilization(a.airportCode)?.utilizationPct ?? null,
    evidence: (a) => {
      const t = getT100(a.airportCode);
      const c = getCapacity(a.airportCode);
      const u = runwayUtilization(a.airportCode);
      const cfg = c?.configuration ?? null;
      return {
        formula:
          "runway utilization = annual operations ÷ ASV, in percent (100% = at capacity); operations = BTS T-100 (latest 12 months) departures × 2; ASV = FAA AC 150/5060-5 Figure 2-1 midpoint for the runway configuration. Sub-score = utilization as a percentage, capped at 100",
        inputs: {
          departures: t?.departures ?? null,
          operations: u?.operations ?? null,
          asv: cfg?.asv ?? null,
          utilization: u?.ratio ?? null,
          utilizationPct: u?.utilizationPct ?? null,
          runwayConfiguration: cfg ? `Figure 2-1 no. ${cfg.figure21No}: ${cfg.label}` : null,
          runways: c && c.runways.length > 0 ? c.runways.map((r) => r.id).join(", ") : null,
        },
        value: u?.utilizationPct ?? null,
        explanation: utilizationSentence(t?.departures ?? null, c, u),
      };
    },
  },
  {
    key: "unmet_demand",
    label: "Unmet demand (load factor)",
    weight: 0.3,
    direction: "higher",
    scale: { kind: "percent", fullAt: 1.0 },
    note: "Load factor = passengers ÷ seats (BTS T-100 (latest 12 months)). A capacity-pressure proxy for spill: turned-away demand becomes material above ~80-85% load factor; true spill needs booking data. Sub-score = the load factor as a percentage (81.7% scores 81.7), capped at 100.",
    extract: (a) => getT100(a.airportCode)?.loadFactor ?? null,
    evidence: (a) => {
      const t = getT100(a.airportCode);
      return {
        formula: "load factor = passengers ÷ seats (BTS T-100 (latest 12 months)). Sub-score = load factor as a percentage, capped at 100",
        inputs: { passengers: t?.passengers ?? null, seats: t?.seats ?? null, loadFactor: t?.loadFactor ?? null },
        value: t?.loadFactor ?? null,
        explanation: t
          ? `Planes averaged ${t.loadFactor}% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%.${t.loadFactor > 100 ? " The sub-score is capped at 100 (load factor above 100%)." : ""}`
          : "No BTS T-100 record for this airport.",
      };
    },
  },
  {
    key: "long_haul",
    label: "Long-haul share",
    weight: 0.2,
    direction: "higher",
    scale: { kind: "percent", fullAt: 0.5 },
    note: "International seats ÷ total seats (BTS T-100 (latest 12 months)). International/long-haul traffic earns higher weight-based fees and needs costly FIS facilities (a gateway moat). Sub-score = the international share ÷ 50% × 100, capped at 100 (50% international = 100; 40% scores 80).",
    extract: (a) => getT100(a.airportCode)?.internationalShare ?? null,
    evidence: (a) => {
      const t = getT100(a.airportCode);
      return {
        formula: "international seats ÷ total seats (BTS T-100 (latest 12 months)). Sub-score = share ÷ 50% × 100, capped at 100",
        inputs: { internationalSeats: t?.internationalSeats ?? null, seats: t?.seats ?? null, internationalShare: t?.internationalShare ?? null },
        value: t?.internationalShare ?? null,
        explanation: t
          ? `${t.internationalShare}% of seats were international over the latest 12 months; scored against a 50% benchmark (50% international = 100) → ${percentScore(t.internationalShare / 100, "higher", 0.5)}.${t.internationalShare > 50 ? " The sub-score is capped at 100 (above 50% international)." : ""} High-margin traffic (weight-based fees, FIS/customs moat).`
          : "No BTS T-100 record for this airport.",
      };
    },
  },
  {
    key: "growth",
    label: "Growth / durability",
    weight: 0.2,
    direction: "higher",
    note: "Enplanement 5-year CAGR, CY2019->CY2024 (FAA), in percent per year. Missing when the airport has no CY2019 or CY2024 figure; never filled from another unit.",
    extract: (a) => growthPctPerYear(a),
    evidence: (a) => {
      const cagr = growthPctPerYear(a);
      const explanation =
        cagr !== null
          ? `Passengers grew ${cagr.toFixed(1)}% per year on average from CY2019 to CY2024.`
          : `No 5-year CAGR: the FAA data has no CY2019 or CY2024 figure for this airport (latest year ${a.latest.year}), so growth is left missing.`;
      return {
        formula: "5-year enplanement CAGR, CY2019→CY2024, % per year: ((CY2024 ÷ CY2019)^(1/5) − 1) × 100",
        inputs: { cagr5yr: cagr, unit: "% per year", enplanements: a.latest.enplanements, year: a.latest.year },
        value: cagr,
        explanation,
      };
    },
  },
];

/** All airports in the FAA dataset — the reference population KPI bounds are fixed against. */
const referencePopulation: readonly AirportRecord[] = Object.values(enplanementsDataset.airports);

/** Scorer with bounds fixed to the full US dataset, so scores are stable and comparable. */
export const investmentScorer = buildScorer(referencePopulation, INVESTMENT_KPIS, { tieBreak: byAirportCode });

/** Score one airport on the ABSOLUTE scale (bounds fixed to all US airports). */
export function scoreAirport(record: AirportRecord): ScoredItem<AirportRecord> {
  return investmentScorer.score(record);
}

/** Rank records on the ABSOLUTE scale (vs. all US airports). Big hubs may saturate the caps. */
export function rankAirports(records: readonly AirportRecord[]): ScoredItem<AirportRecord>[] {
  return investmentScorer.rank(records);
}

/**
 * Rank records RELATIVE to each other: KPI bounds come from the compared set itself, so a
 * score of 100 means "best among these" and the comparison actually differentiates (e.g. a
 * big international gateway beats a domestic hub on long-haul). This is the right mode for
 * "compare / rank these airports". Needs >= 2 records to be meaningful.
 */
export function rankAirportsRelative(records: readonly AirportRecord[]): ScoredItem<AirportRecord>[] {
  return buildScorer(records, INVESTMENT_KPIS, { tieBreak: byAirportCode }).rank(records);
}
