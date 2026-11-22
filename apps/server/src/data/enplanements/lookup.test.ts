import { describe, expect, it } from "vitest";
import { enplanementsDataset } from "./dataset.ts";
import { getEnplanements } from "./lookup.ts";

describe("getEnplanements", () => {
  it("returns the real LAX record: hub L, CY2024 = 37,760,834", () => {
    const lax = getEnplanements("LAX");
    expect(lax?.hubType).toBe("L");
    expect(lax?.latest.year).toBe(2024);
    expect(lax?.latest.enplanements).toBe(37760834);
    expect(lax?.source).toBe("FAA Passenger Boarding (Enplanement) Data");
  });

  it("trims and ignores case", () => {
    expect(getEnplanements("  lax ")).toEqual(getEnplanements("LAX"));
  });

  it("returns null for unknown codes, never a made-up record", () => {
    expect(getEnplanements("ZZZ")).toBeNull();
    expect(getEnplanements("")).toBeNull();
    expect(getEnplanements("__proto__")).toBeNull();
  });

  it("returns null for ICAO codes: the dataset uses FAA LocIDs only", () => {
    expect(getEnplanements("KLAX")).toBeNull();
    expect(getEnplanements("KATL")).toBeNull();
  });

  it("returns null, not a TypeError, for a non-string code", () => {
    for (const bad of [123, null, undefined, {}, ["LAX"]]) expect(getEnplanements(bad)).toBeNull();
  });

  it("answers in under 5 ms on average after the first load", () => {
    getEnplanements("ATL"); // warm up
    const calls = 100;
    const start = performance.now();
    for (let i = 0; i < calls; i++) getEnplanements("ATL");
    expect((performance.now() - start) / calls).toBeLessThan(5);
  });
});

describe("dataset invariants", () => {
  it("covers 10 years and 575 airports", () => {
    expect(enplanementsDataset.meta.years).toHaveLength(10);
    expect(Object.keys(enplanementsDataset.airports)).toHaveLength(enplanementsDataset.meta.airportCount);
    expect(enplanementsDataset.meta.airportCount).toBeGreaterThan(300);
  });

  it("every record has a matching code, a non-empty ascending series and a latest year", () => {
    for (const [code, rec] of Object.entries(enplanementsDataset.airports)) {
      expect(code).toMatch(/^[A-Z0-9]{3,4}$/);
      expect(rec.airportCode).toBe(code);
      expect(rec.series.length).toBeGreaterThan(0);
      const years = rec.series.map((p) => p.year);
      expect(years).toEqual([...years].sort((a, b) => a - b));
      expect(years.at(-1)).toBe(rec.latest.year);
    }
  });
});
