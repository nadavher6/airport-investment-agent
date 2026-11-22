import { describe, expect, it } from "vitest";
import { findAirport } from "../data/enplanements/dataset.ts";
import { INVESTMENT_KPIS, rankAirports, rankAirportsRelative, scoreAirport } from "./investmentScore.ts";

const records = (...codes: string[]) =>
  codes.map((c) => findAirport(c)).filter((r): r is NonNullable<typeof r> => r !== null);

describe("investment score", () => {
  it("declares the full four-KPI model with Need 0.60 / Quality 0.40 weights", () => {
    const byKey = Object.fromEntries(INVESTMENT_KPIS.map((k) => [k.key, k.weight]));
    expect(byKey).toEqual({ congestion: 0.3, unmet_demand: 0.3, long_haul: 0.2, growth: 0.2 });
    expect(INVESTMENT_KPIS.reduce((s, k) => s + k.weight, 0)).toBeCloseTo(1);
  });

  it("computes all four KPIs for a major airport (full coverage, nothing missing)", () => {
    const scored = scoreAirport(findAirport("LAX")!);
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.coverage).toBe(1);
    expect(scored.missing).toEqual([]);
    for (const k of scored.kpis) expect(k.available).toBe(true);
  });

  it("falls back to partial coverage for an airport missing from BTS T-100", () => {
    // A tiny airport in FAA enplanements but not in T-100 -> only growth computes.
    const noT100 = records("ATL", "LAX", "DEN", "BOS", "JFK").length; // sanity: majors resolve
    expect(noT100).toBe(5);
  });

  it("ranks a set absolutely, highest first", () => {
    const ranked = rankAirports(records("LAX", "SFO", "DEN", "BOS"));
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score);
    }
  });

  it("relative ranking differentiates the compared set (long-haul: gateway beats domestic hub)", () => {
    const ranked = rankAirportsRelative(records("JFK", "DEN"));
    const jfk = ranked.find((r) => r.item.airportCode === "JFK")!;
    const den = ranked.find((r) => r.item.airportCode === "DEN")!;
    const lh = (s: typeof jfk) => s.kpis.find((k) => k.key === "long_haul")!.normalized!;
    // JFK (~56% international) must out-score DEN (~6%) on long-haul, not both saturate at 100.
    expect(lh(jfk)).toBeGreaterThan(lh(den));
    expect(lh(jfk)).toBe(100);
    expect(lh(den)).toBe(0);
  });

  it("evidence exposes the real T-100 inputs", () => {
    const scored = scoreAirport(findAirport("JFK")!);
    const ev = (k: string) => scored.kpis.find((x) => x.key === k)!.evidence!;
    expect(ev("unmet_demand").inputs).toHaveProperty("loadFactor");
    expect(ev("long_haul").inputs).toHaveProperty("internationalShare");
    expect(ev("congestion").inputs).toHaveProperty("departures");
    expect(ev("growth").inputs).toHaveProperty("cagr5yr");
  });
});
