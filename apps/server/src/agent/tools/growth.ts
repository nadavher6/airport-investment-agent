// The growth facts get_growth adds to its category output (#67): the CY2015-CY2024 enplanement series and
// the trend facts, all read from data/enplanements.json. Nothing is interpolated: a year the FAA file has no
// figure for is null (a gap in the chart). The CAGRs and the recovery ratio are the dataset's own `trend`
// values, the same numbers score_airports' growth evidence and get_enplanements return.
import type { AirportRecord } from "../../data/enplanements/types.ts";

/** One year of the series; null when the airport is missing from that year's FAA file. */
export interface GrowthPoint {
  readonly year: number;
  readonly enplanements: number | null;
}

export interface GrowthFacts {
  /** Every dataset year (meta.years, ascending), so always the same 10 entries for CY2015-CY2024. */
  readonly series: readonly GrowthPoint[];
  /** CAGR CY2019 -> CY2024 (5 periods), percent per year. The dataset's trend.cagr5yr. */
  readonly cagr5yr: number | null;
  /** CAGR CY2015 -> CY2024, percent per year. Despite the name it spans 9 periods (see cagr10yrPeriods). */
  readonly cagr10yr: number | null;
  /** Always 9: CY2015 -> CY2024 is 9 compounding periods, not 10. */
  readonly cagr10yrPeriods: 9;
  /** Latest-year enplanements ÷ CY2019 (1 = fully recovered). The dataset's trend.recoveryVs2019. */
  readonly recoveryVs2019: number | null;
  /** The latest year in the file, its enplanements and its YoY % (from that year's own prior-year figure). */
  readonly latest: { readonly year: number; readonly enplanements: number; readonly yoyChangePct: number | null };
  /** The CY2020 COVID low: the value and its % change vs CY2019; nulls when either year is missing. */
  readonly covid2020: { readonly enplanements: number | null; readonly pctVs2019: number | null };
  /** The highest year in the series (the earliest one on a tie); null only for an empty series. */
  readonly peak: { readonly year: number; readonly enplanements: number } | null;
}

/** Percent change, rounded to 4 decimals like the dataset's own trend fields. */
const pctChange = (value: number, base: number): number => Math.round((value / base - 1) * 100 * 10_000) / 10_000;

/** The growth facts of one airport over the dataset's years. Pure; never invents a value. */
export function growthFacts(record: AirportRecord, years: readonly number[]): GrowthFacts {
  const byYear = new Map(record.series.map((p) => [p.year, p.enplanements]));
  const series = [...years].sort((a, b) => a - b).map((year): GrowthPoint => ({ year, enplanements: byYear.get(year) ?? null }));
  const v2019 = byYear.get(2019) ?? null;
  const v2020 = byYear.get(2020) ?? null;
  let peak: GrowthFacts["peak"] = null;
  for (const p of series) {
    if (p.enplanements !== null && (peak === null || p.enplanements > peak.enplanements)) peak = { year: p.year, enplanements: p.enplanements };
  }
  return {
    series,
    cagr5yr: record.trend.cagr5yr,
    cagr10yr: record.trend.cagr10yr,
    cagr10yrPeriods: 9,
    recoveryVs2019: record.trend.recoveryVs2019,
    latest: { year: record.latest.year, enplanements: record.latest.enplanements, yoyChangePct: record.latest.yoyChangePct },
    covid2020: { enplanements: v2020, pctVs2019: v2020 !== null && v2019 !== null && v2019 > 0 ? pctChange(v2020, v2019) : null },
    peak,
  };
}
