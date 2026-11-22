import { describe, expect, it } from "vitest";
import { getT100, t100Dataset } from "./dataset.ts";

describe("t100 dataset", () => {
  it("loads a plausible number of airports for the latest year", () => {
    expect(t100Dataset.meta.year).toBe(2024);
    expect(t100Dataset.meta.airportCount).toBeGreaterThan(500);
  });

  it("looks up an airport case-insensitively and returns consistent stats", () => {
    const lax = getT100("lax");
    expect(lax).not.toBeNull();
    expect(getT100("LAX")).toEqual(lax);
    expect(lax!.seats).toBeGreaterThan(0);
    // load factor and international share are self-consistent with the raw counts
    expect(lax!.loadFactor).toBeCloseTo(Math.round((lax!.passengers / lax!.seats) * 1000) / 10, 1);
    expect(lax!.internationalSeats).toBe(lax!.seats - lax!.domesticSeats);
  });

  it("captures JFK as a major international gateway and DEN as domestic-heavy", () => {
    expect(getT100("JFK")!.internationalShare).toBeGreaterThan(40);
    expect(getT100("DEN")!.internationalShare).toBeLessThan(15);
  });

  it("returns null for a non-string or unknown code", () => {
    expect(getT100(123)).toBeNull();
    expect(getT100("ZZZ")).toBeNull();
  });
});
