import { describe, expect, it } from "vitest";
import { assembleDataset, cagrPct, findRevisions, ratio, serializeDataset, yoyChangePct } from "./assemble.ts";
import type { YearRow, YearTable } from "./types.ts";

function row(airportCode: string, enplanements: number, prior: number | null, extra: Partial<YearRow> = {}): YearRow {
  return {
    airportCode, name: `${airportCode} Airport`, city: "City", state: "CA", serviceLevel: "P", hubType: "S",
    rank: 1, enplanements, priorYearEnplanements: prior, ...extra,
  };
}

const TABLES: YearTable[] = [
  { year: 2024, rows: [row("AAA", 1210, 1100, { name: "AAA New Name", hubType: "M" }), row("CCC", 50, null)] },
  { year: 2015, rows: [row("AAA", 1000, 900), row("BBB", 10, 9, { serviceLevel: "CS", hubType: null })] },
  { year: 2019, rows: [row("AAA", 1100, 1050)] },
  { year: 2020, rows: [row("AAA", 500, 1111, { hubType: "N" })] }, // 1111: a revised 2019 figure
];

describe("formulas", () => {
  it("yoyChangePct = (latest - prior) / prior * 100, null-guarded", () => {
    expect(yoyChangePct(10202, 10055)).toBeCloseTo(1.46, 2);
    expect(yoyChangePct(5, null)).toBeNull();
    expect(yoyChangePct(5, 0)).toBeNull();
  });

  it("cagrPct = ((end / start)^(1/n) - 1) * 100, null-guarded", () => {
    expect(cagrPct(100, 121, 2)).toBeCloseTo(10, 6);
    expect(cagrPct(null, 121, 2)).toBeNull();
    expect(cagrPct(100, null, 2)).toBeNull();
    expect(cagrPct(0, 121, 2)).toBeNull();
  });

  it("ratio is null-guarded", () => {
    expect(ratio(50, 100)).toBe(0.5);
    expect(ratio(50, null)).toBeNull();
    expect(ratio(50, 0)).toBeNull();
  });
});

describe("assembleDataset", () => {
  const dataset = assembleDataset(TABLES, "2026-01-02");

  it("writes meta with ascending years and unique codes across all years", () => {
    expect(dataset.meta).toEqual({
      source: "FAA Passenger Boarding (Enplanement) Data", years: [2015, 2019, 2020, 2024], builtAt: "2026-01-02", airportCount: 3,
    });
    expect(Object.keys(dataset.airports)).toEqual(["AAA", "BBB", "CCC"]);
  });

  it("builds an ascending series, omits missing years and keeps each year's own value and hub", () => {
    const aaa = dataset.airports["AAA"];
    expect(aaa?.series.map((p) => [p.year, p.enplanements, p.hubType])).toEqual([
      [2015, 1000, "S"], [2019, 1100, "S"], [2020, 500, "N"], [2024, 1210, "M"],
    ]);
  });

  it("takes name and hubType from the latest year", () => {
    expect(dataset.airports["AAA"]).toMatchObject({ name: "AAA New Name", hubType: "M" });
    expect(dataset.airports["BBB"]?.hubType).toBeNull();
  });

  it("computes latest and trend (cagr10yr uses 9 periods)", () => {
    const aaa = dataset.airports["AAA"];
    expect(aaa?.latest).toEqual({ year: 2024, enplanements: 1210, priorYear: 1100, yoyChangePct: 10, rank: 1 });
    expect(aaa?.trend.cagr5yr).toBeCloseTo(((1210 / 1100) ** (1 / 5) - 1) * 100, 3);
    expect(aaa?.trend.cagr10yr).toBeCloseTo(((1210 / 1000) ** (1 / 9) - 1) * 100, 3);
    expect(aaa?.trend.recoveryVs2019).toBe(1.1);
  });

  it("uses null when an endpoint or the prior figure is missing", () => {
    expect(dataset.airports["CCC"]?.latest.yoyChangePct).toBeNull();
    expect(dataset.airports["CCC"]?.trend).toEqual({ cagr5yr: null, cagr10yr: null, recoveryVs2019: null });
    // BBB only appears in 2015: its latest year is 2015, so there is no 2024 endpoint.
    expect(dataset.airports["BBB"]?.latest.year).toBe(2015);
    expect(dataset.airports["BBB"]?.trend.cagr10yr).toBeNull();
  });

  it("serializes the same way every time, independent of table order", () => {
    const reversed = assembleDataset([...TABLES].reverse(), "2026-01-02");
    expect(serializeDataset(reversed)).toBe(serializeDataset(dataset));
  });
});

describe("findRevisions", () => {
  it("reports where the next file's prior-year figure differs from the year's own file", () => {
    expect(findRevisions(TABLES)).toEqual([{ airportCode: "AAA", year: 2019, original: 1100, revised: 1111 }]);
  });
});
