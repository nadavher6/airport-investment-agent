import { KpiTiles } from "../KpiTiles";
import { LineChart, type LineChartSpec, type LineMarker } from "../LineChart";
import type { KpiSpec } from "../spec";
import { formatScore } from "./spec";
import type { CategoryResult, GrowthAirport } from "./categorySpec";

/**
 * The growth view (#67): get_growth's yearly enplanement series as #33's line chart (one series per airport,
 * gaps for missing years), with the 2019 baseline and the 2020 COVID low marked, and a KPI row per airport.
 * Every number comes from the tool result; nothing is computed here beyond formatting.
 */

/** The two annotations: labels sit on opposite sides so the adjacent years never collide. */
export const GROWTH_MARKERS: readonly LineMarker[] = [
  { x: 2019, label: "2019 pre-COVID baseline", side: "left" },
  { x: 2020, label: "2020 COVID low", side: "right" },
];

export function growthChartSpec(airports: readonly GrowthAirport[]): LineChartSpec {
  return {
    title: "Passenger enplanements by year",
    x: "Calendar year",
    unit: "enplanements",
    series: airports.map((a) => ({
      name: a.airportCode,
      points: a.growth.series.map((p) => [p.year, p.enplanements] as const),
    })),
  };
}

const pct = (v: number): string => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

/** The KPI row of one airport: 5-yr CAGR, recovery vs 2019, the latest year (with YoY) and the sub-score. */
export function growthKpis(result: CategoryResult, a: GrowthAirport): KpiSpec {
  const g = a.growth;
  const items: KpiSpec["items"] = [
    { label: "5-yr CAGR (2019–2024)", value: g.cagr5yr === null ? "—" : pct(g.cagr5yr), ...(g.cagr5yr === null ? {} : { unit: "per year" }) },
    {
      label: "Recovery vs 2019",
      value: g.recoveryVs2019 === null ? "—" : `${(g.recoveryVs2019 * 100).toFixed(0)}%`,
      ...(g.recoveryVs2019 === null ? {} : { unit: "of 2019" }),
    },
    {
      label: `Latest (CY${g.latest.year})`,
      value: g.latest.enplanements,
      ...(g.latest.yoyChangePct === null ? {} : { delta: `${pct(g.latest.yoyChangePct)} YoY` }),
    },
    { label: `${result.label} sub-score`, value: a.subScore === null ? "—" : formatScore(a.subScore), ...(a.subScore === null ? {} : { unit: "/ 100" }) },
  ];
  return { type: "kpi", title: a.name ? `${a.airportCode} · ${a.name}` : a.airportCode, items };
}

export function GrowthView({ result, airports }: { result: CategoryResult; airports: readonly GrowthAirport[] }) {
  return (
    <div className="score-growth" data-testid="growth-view">
      <LineChart spec={growthChartSpec(airports)} markers={GROWTH_MARKERS} />
      {airports.map((a) => (
        <div key={a.airportCode} data-testid="growth-kpis">
          <KpiTiles spec={growthKpis(result, a)} />
        </div>
      ))}
    </div>
  );
}
