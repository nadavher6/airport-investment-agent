/**
 * Airport Investment Attractiveness Score — v0 (tasks/06-scoring-formula-research.md).
 *
 * Full model = Need 0.60 (congestion + unmet demand) / Quality 0.40 (long-haul + growth).
 * v0 computes only what the FAA enplanement dataset supports: Growth (real) and Unmet demand
 * (a degraded proxy = demand magnitude). Congestion and Long-haul need BTS T-100 (v1) and are
 * declared here with weight but return null, so the engine reports coverage = 0.50 and names
 * them as missing — the ranking is honest about what it does and doesn't yet measure.
 */
import { enplanementsDataset } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { buildScorer, type KpiDef, type ScoredItem } from "./engine.ts";

export const INVESTMENT_KPIS: readonly KpiDef<AirportRecord>[] = [
  {
    key: "congestion",
    label: "Congestion / capacity pressure",
    weight: 0.3,
    direction: "higher",
    note: "Pending BTS T-100 operations + ASV approximation (v1); not computed in v0.",
    extract: () => null,
  },
  {
    key: "unmet_demand",
    label: "Unmet demand (v0 proxy: demand magnitude)",
    weight: 0.3,
    direction: "higher",
    note: "v0 proxies capacity pressure by latest-year enplanements; v1 uses load factor (BTS T-100).",
    extract: (a) => a.latest.enplanements,
  },
  {
    key: "long_haul",
    label: "Long-haul share",
    weight: 0.2,
    direction: "higher",
    note: "Pending BTS T-100 International share (v1); not computed in v0.",
    extract: () => null,
  },
  {
    key: "growth",
    label: "Growth / durability",
    weight: 0.2,
    direction: "higher",
    note: "Enplanement 5-year CAGR (FY2019->FY2024); falls back to recovery-vs-2019 when CAGR is missing.",
    extract: (a) => a.trend.cagr5yr ?? (a.trend.recoveryVs2019 !== null ? (a.trend.recoveryVs2019 - 1) * 100 : null),
  },
];

/** All airports in the FAA dataset — the reference population KPI bounds are fixed against. */
const referencePopulation: readonly AirportRecord[] = Object.values(enplanementsDataset.airports);

/** Scorer with bounds fixed to the full US dataset, so scores are stable and comparable. */
export const investmentScorer = buildScorer(referencePopulation, INVESTMENT_KPIS);

/** Score one airport record on the fixed scale. */
export function scoreAirport(record: AirportRecord): ScoredItem<AirportRecord> {
  return investmentScorer.score(record);
}

/** Rank a set of airport records, highest score first. */
export function rankAirports(records: readonly AirportRecord[]): ScoredItem<AirportRecord>[] {
  return investmentScorer.rank(records);
}
