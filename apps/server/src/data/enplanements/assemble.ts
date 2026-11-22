// Joins the parsed year tables into the dataset written to data/enplanements.json.
// Pure and deterministic: the same tables and builtAt give the same output.
import type {
  AirportRecord,
  EnplanementsDataset,
  LatestYear,
  SeriesPoint,
  Trend,
  YearRow,
  YearTable,
} from "./types.ts";

export const DATASET_SOURCE = "FAA Passenger Boarding (Enplanement) Data";

/** Rates are rounded to this many decimals, so the JSON stays readable and stable. */
const DECIMALS = 4;

export function round(value: number): number {
  const factor = 10 ** DECIMALS;
  return Math.round(value * factor) / factor;
}

/** (current - prior) / prior * 100, or null when either is missing or prior is 0. */
export function yoyChangePct(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return round(((current - prior) / prior) * 100);
}

/** Compound annual growth rate in percent: ((end / start)^(1 / periods) - 1) * 100. */
export function cagrPct(start: number | null, end: number | null, periods: number): number | null {
  if (start === null || end === null || start <= 0 || end < 0 || periods <= 0) return null;
  return round(((end / start) ** (1 / periods) - 1) * 100);
}

/** end / start, or null when either is missing or start is 0. */
export function ratio(end: number | null, start: number | null): number | null {
  if (end === null || start === null || start === 0) return null;
  return round(end / start);
}

function valueIn(series: readonly SeriesPoint[], year: number): number | null {
  return series.find((point) => point.year === year)?.enplanements ?? null;
}

function trendOf(series: readonly SeriesPoint[], latestEnplanements: number): Trend {
  return {
    cagr5yr: cagrPct(valueIn(series, 2019), valueIn(series, 2024), 5),
    // Named "10yr" for the 2015-2024 window, but that is 9 compounding periods.
    cagr10yr: cagrPct(valueIn(series, 2015), valueIn(series, 2024), 9),
    recoveryVs2019: ratio(latestEnplanements, valueIn(series, 2019)),
  };
}

function airportRecord(rowsByYear: readonly { year: number; row: YearRow }[]): AirportRecord {
  const last = rowsByYear[rowsByYear.length - 1];
  if (!last) throw new Error("airportRecord needs at least one row");
  const { row: latestRow, year: latestYear } = last;

  const series: SeriesPoint[] = rowsByYear.map(({ year, row }) => ({
    year,
    enplanements: row.enplanements,
    rank: row.rank,
    hubType: row.hubType,
  }));
  const latest: LatestYear = {
    year: latestYear,
    enplanements: latestRow.enplanements,
    priorYear: latestRow.priorYearEnplanements,
    yoyChangePct: yoyChangePct(latestRow.enplanements, latestRow.priorYearEnplanements),
    rank: latestRow.rank,
  };
  return {
    airportCode: latestRow.airportCode,
    name: latestRow.name,
    city: latestRow.city,
    state: latestRow.state,
    hubType: latestRow.hubType,
    series,
    latest,
    trend: trendOf(series, latestRow.enplanements),
  };
}

/**
 * Builds the dataset. Each year's value comes from that year's own file (FAA revisions in the
 * next file's prior-year column are ignored here; see findRevisions). Airports are keyed on
 * Locid and sorted by code; name, city and state come from the latest year the airport appears.
 */
export function assembleDataset(tables: readonly YearTable[], builtAt: string): EnplanementsDataset {
  const sorted = [...tables].sort((a, b) => a.year - b.year);
  const years = sorted.map((table) => table.year);
  if (new Set(years).size !== years.length) throw new Error(`duplicate years: ${years.join(", ")}`);

  const byCode = new Map<string, { year: number; row: YearRow }[]>();
  for (const table of sorted) {
    for (const row of table.rows) {
      const list = byCode.get(row.airportCode) ?? [];
      list.push({ year: table.year, row });
      byCode.set(row.airportCode, list);
    }
  }

  const codes = [...byCode.keys()].sort();
  const airports: Record<string, AirportRecord> = {};
  for (const code of codes) {
    airports[code] = airportRecord(byCode.get(code) ?? []);
  }

  return {
    meta: { source: DATASET_SOURCE, years, builtAt, airportCount: codes.length },
    airports,
  };
}

export interface Revision {
  readonly airportCode: string;
  readonly year: number;
  /** The figure in that year's own file (the one the dataset uses). */
  readonly original: number;
  /** The prior-year figure printed in the next year's file. */
  readonly revised: number;
}

/** Cross-check: where the next file's prior-year column disagrees with a year's own figure. */
export function findRevisions(tables: readonly YearTable[]): Revision[] {
  const byYear = new Map(tables.map((table) => [table.year, table]));
  const revisions: Revision[] = [];
  for (const table of [...tables].sort((a, b) => a.year - b.year)) {
    const previous = byYear.get(table.year - 1);
    if (!previous) continue;
    const previousByCode = new Map(previous.rows.map((row) => [row.airportCode, row]));
    for (const row of table.rows) {
      const own = previousByCode.get(row.airportCode);
      const printed = row.priorYearEnplanements;
      if (own && printed !== null && printed !== own.enplanements) {
        revisions.push({ airportCode: row.airportCode, year: previous.year, original: own.enplanements, revised: printed });
      }
    }
  }
  return revisions;
}

/** Pretty-printed JSON with a trailing newline. Key order is fixed by construction. */
export function serializeDataset(dataset: EnplanementsDataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}
