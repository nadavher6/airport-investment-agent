// Checks the committed data/enplanements.json. Needs no raw FAA files.
import { describe, expect, it } from "vitest";
import { enplanementsDataset as dataset, findAirport } from "./dataset.ts";
import type { AirportRecord } from "./types.ts";

const airports: AirportRecord[] = Object.values(dataset.airports);

function valueIn(airport: AirportRecord | null, year: number): number | undefined {
  return airport?.series.find((point) => point.year === year)?.enplanements;
}

describe("meta", () => {
  it("covers CY2015-CY2024 with 575 unique airports, 513 of them in CY2024", () => {
    expect(dataset.meta.source).toBe("FAA Passenger Boarding (Enplanement) Data");
    expect(dataset.meta.years).toEqual([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
    expect(dataset.meta.builtAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dataset.meta.airportCount).toBe(575);
    expect(airports).toHaveLength(575);
    expect(airports.filter((a) => a.series.some((p) => p.year === 2024))).toHaveLength(513);
  });
});

describe("spot checks (FAA figures)", () => {
  const cases = [
    { code: "ATL", y2015: 49340732, y2019: 53505795, y2020: 20559866, y2024: 52511402, rank: 1, cagr10yr: 0.69, cagr5yr: -0.37, recovery: 0.981 },
    { code: "LAX", y2015: 36351272, y2019: 42939104, y2020: 14055777, y2024: 37760834, rank: 5, cagr10yr: 0.42, cagr5yr: -2.54, recovery: 0.879 },
    { code: "ORD", y2015: 36305668, y2019: 40871223, y2020: 14606034, y2024: 38575693, rank: 4, cagr10yr: 0.68, cagr5yr: -1.15, recovery: 0.944 },
  ];

  it.each(cases)("$code matches the FAA numbers", (c) => {
    const airport = findAirport(c.code);
    expect(airport).not.toBeNull();
    expect(valueIn(airport, 2015)).toBe(c.y2015);
    expect(valueIn(airport, 2019)).toBe(c.y2019);
    expect(valueIn(airport, 2020)).toBe(c.y2020);
    expect(valueIn(airport, 2024)).toBe(c.y2024);
    expect(airport?.latest).toMatchObject({ year: 2024, enplanements: c.y2024, rank: c.rank });
    expect(airport?.trend.cagr10yr).toBeCloseTo(c.cagr10yr, 2);
    expect(airport?.trend.cagr5yr).toBeCloseTo(c.cagr5yr, 2);
    // recoveryVs2019 is given to 3 decimals in the issue; check it to 2 decimals, plus the 3-decimal rounding.
    expect(airport?.trend.recoveryVs2019).toBeCloseTo(c.recovery, 2);
    expect(Number(airport?.trend.recoveryVs2019?.toFixed(3))).toBe(c.recovery);
  });
});

describe("invariants", () => {
  it("every code is 3-4 upper-case letters or digits and matches its key", () => {
    for (const [key, airport] of Object.entries(dataset.airports)) {
      expect(key).toMatch(/^[A-Z0-9]{3,4}$/);
      expect(airport.airportCode).toBe(key);
    }
  });

  it("keys are sorted, so the file diffs cleanly", () => {
    const keys = Object.keys(dataset.airports);
    expect(keys).toEqual([...keys].sort());
  });

  it("every series is non-empty, ascending, and ends at the latest year", () => {
    for (const airport of airports) {
      expect(airport.series.length).toBeGreaterThan(0);
      const years = airport.series.map((p) => p.year);
      expect(years).toEqual([...years].sort((a, b) => a - b));
      expect(new Set(years).size).toBe(years.length);
      expect(airport.latest.year).toBe(years[years.length - 1]);
      expect(airport.latest.enplanements).toBe(airport.series[airport.series.length - 1]?.enplanements);
    }
  });

  it("no hubType is the string None; every hubType is L/M/S/N or null", () => {
    const allowed = new Set(["L", "M", "S", "N", null]);
    for (const airport of airports) {
      expect(allowed.has(airport.hubType)).toBe(true);
      for (const point of airport.series) expect(allowed.has(point.hubType)).toBe(true);
    }
    expect(JSON.stringify(dataset)).not.toContain('"None"');
  });

  it("latest.yoyChangePct is computed from the latest file's own prior-year figure", () => {
    for (const { latest } of airports) {
      if (latest.priorYear === null || latest.priorYear === 0) {
        expect(latest.yoyChangePct).toBeNull();
      } else {
        expect(latest.yoyChangePct).toBeCloseTo(((latest.enplanements - latest.priorYear) / latest.priorYear) * 100, 3);
      }
    }
  });

  it("every enplanement figure is a whole non-negative number", () => {
    for (const airport of airports) {
      for (const point of airport.series) expect(Number.isInteger(point.enplanements) && point.enplanements >= 0).toBe(true);
    }
  });

  it("CY2019 SDY grew +1.46% (the FAA's % Change column wrongly says -0.03%)", () => {
    const sdy = findAirport("SDY");
    const y2018 = valueIn(sdy, 2018);
    const y2019 = valueIn(sdy, 2019);
    expect([y2018, y2019]).toEqual([10055, 10202]);
    expect((((y2019 ?? 0) - (y2018 ?? 0)) / (y2018 ?? 1)) * 100).toBeCloseTo(1.46, 2);
  });
});

describe("findAirport", () => {
  it("is case-insensitive and returns null for unknown codes", () => {
    expect(findAirport(" lax ")?.airportCode).toBe("LAX");
    expect(findAirport("ZZZZ")).toBeNull();
    expect(findAirport("constructor")).toBeNull();
  });
});
