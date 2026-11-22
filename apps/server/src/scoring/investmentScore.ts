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
    evidence: () => ({
      formula: "annual operations ÷ capacity (FAA Annual Service Volume); FAA thresholds 0.60 / 0.80 / 0.95",
      inputs: {},
      value: null,
      explanation: "Not computed in v0 — needs flight-operations and runway-capacity data (BTS T-100 + FAA). Coming in v1.",
    }),
  },
  {
    key: "unmet_demand",
    label: "Unmet demand (v0 proxy: demand magnitude)",
    weight: 0.3,
    direction: "higher",
    note: "v0 proxies capacity pressure by latest-year enplanements; v1 uses load factor (BTS T-100).",
    extract: (a) => a.latest.enplanements,
    evidence: (a) => ({
      formula: "v0 proxy: latest-year enplanements (demand magnitude). v1: unconstrained demand ≈ load factor × growth (BTS T-100).",
      inputs: { enplanements: a.latest.enplanements, year: a.latest.year },
      value: a.latest.enplanements,
      explanation: `${a.latest.enplanements.toLocaleString("en-US")} passengers boarded in ${a.latest.year}; used as a stand-in for demand pressure (the real version will use how full the planes are).`,
    }),
  },
  {
    key: "long_haul",
    label: "Long-haul share",
    weight: 0.2,
    direction: "higher",
    note: "Pending BTS T-100 International share (v1); not computed in v0.",
    extract: () => null,
    evidence: () => ({
      formula: "international seats ÷ total seats (BTS T-100 International)",
      inputs: {},
      value: null,
      explanation: "Not computed in v0 — needs international flight data (BTS T-100 International). Coming in v1.",
    }),
  },
  {
    key: "growth",
    label: "Growth / durability",
    weight: 0.2,
    direction: "higher",
    note: "Enplanement 5-year CAGR (FY2019->FY2024); falls back to recovery-vs-2019 when CAGR is missing.",
    extract: (a) => a.trend.cagr5yr ?? (a.trend.recoveryVs2019 !== null ? (a.trend.recoveryVs2019 - 1) * 100 : null),
    evidence: (a) => {
      const cagr = a.trend.cagr5yr;
      const rec = a.trend.recoveryVs2019;
      const value = cagr ?? (rec !== null ? (rec - 1) * 100 : null);
      const explanation =
        cagr !== null
          ? `Passengers grew ${cagr.toFixed(1)}% per year on average from 2019 to 2024.`
          : rec !== null
            ? `No 5-year CAGR; using recovery ratio ${rec.toFixed(2)} vs 2019 instead.`
            : "No growth data available for this airport.";
      return {
        formula: "5-year enplanement CAGR, FY2019→FY2024 (fallback: recoveryVs2019 − 1)",
        inputs: { cagr5yr: cagr, recoveryVs2019: rec, enplanements: a.latest.enplanements, year: a.latest.year },
        value,
        explanation,
      };
    },
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
