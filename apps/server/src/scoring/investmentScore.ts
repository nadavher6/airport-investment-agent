/**
 * Airport Investment Attractiveness Score (tasks/06-scoring-formula-research.md).
 *
 * Full model = Need 0.60 (congestion + unmet demand) / Quality 0.40 (long-haul + growth):
 * - congestion   — annual departures (BTS T-100 (latest 12 months)), a traffic-volume proxy for capacity pressure
 * - unmet_demand — load factor = passengers ÷ seats (BTS T-100 (latest 12 months)), proxy for spilled demand
 * - long_haul    — international seats ÷ total seats (BTS T-100 (latest 12 months))
 * - growth       — enplanement 5-year CAGR (FAA data)
 *
 * All four are computed, so an airport present in both datasets reports coverage = 1.0.
 * An airport missing from a source yields null for that KPI; the engine renormalizes weights
 * over the available KPIs and reports `coverage` + `missing`, so partial data stays honest.
 */
import { enplanementsDataset } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { getT100 } from "../data/t100/dataset.ts";
import { buildScorer, type KpiDef, type ScoredItem } from "./engine.ts";

export const INVESTMENT_KPIS: readonly KpiDef<AirportRecord>[] = [
  {
    key: "congestion",
    label: "Congestion / capacity pressure",
    weight: 0.3,
    direction: "higher",
    note: "Annual departures (operations) from BTS T-100 (latest 12 months) — a traffic-volume proxy; a true utilization ratio (operations ÷ FAA ASV) needs runway-capacity data not freely tabulated.",
    extract: (a) => getT100(a.airportCode)?.departures ?? null,
    evidence: (a) => {
      const t = getT100(a.airportCode);
      return {
        formula: "annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)",
        inputs: { departures: t?.departures ?? null },
        value: t?.departures ?? null,
        explanation: t
          ? `${t.departures.toLocaleString("en-US")} departures over the latest 12 months — a busy airfield is more congestion-prone (capacity denominator ASV is not freely published, so volume is used as the proxy).`
          : "No BTS T-100 record for this airport.",
      };
    },
  },
  {
    key: "unmet_demand",
    label: "Unmet demand (load factor)",
    weight: 0.3,
    direction: "higher",
    note: "Load factor = passengers ÷ seats (BTS T-100 (latest 12 months)). A capacity-pressure proxy for spill: turned-away demand becomes material above ~80-85% load factor; true spill needs booking data.",
    extract: (a) => getT100(a.airportCode)?.loadFactor ?? null,
    evidence: (a) => {
      const t = getT100(a.airportCode);
      return {
        formula: "load factor = passengers ÷ seats (BTS T-100 (latest 12 months))",
        inputs: { passengers: t?.passengers ?? null, seats: t?.seats ?? null, loadFactor: t?.loadFactor ?? null },
        value: t?.loadFactor ?? null,
        explanation: t
          ? `Planes averaged ${t.loadFactor}% full over the latest 12 months; the fuller they run, the more peak-day demand is spilled (turned away) — material above ~80-85%.`
          : "No BTS T-100 record for this airport.",
      };
    },
  },
  {
    key: "long_haul",
    label: "Long-haul share",
    weight: 0.2,
    direction: "higher",
    note: "International seats ÷ total seats (BTS T-100 (latest 12 months)). International/long-haul traffic earns higher weight-based fees and needs costly FIS facilities (a gateway moat).",
    extract: (a) => getT100(a.airportCode)?.internationalShare ?? null,
    evidence: (a) => {
      const t = getT100(a.airportCode);
      return {
        formula: "international seats ÷ total seats (BTS T-100 (latest 12 months))",
        inputs: { internationalSeats: t?.internationalSeats ?? null, seats: t?.seats ?? null, internationalShare: t?.internationalShare ?? null },
        value: t?.internationalShare ?? null,
        explanation: t
          ? `${t.internationalShare}% of seats were international over the latest 12 months — high-margin traffic (weight-based fees, FIS/customs moat).`
          : "No BTS T-100 record for this airport.",
      };
    },
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
  return buildScorer(records, INVESTMENT_KPIS).rank(records);
}
