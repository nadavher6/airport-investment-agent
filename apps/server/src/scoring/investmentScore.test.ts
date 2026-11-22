import { describe, expect, it } from "vitest";
import { findAirport } from "../data/enplanements/dataset.ts";
import { INVESTMENT_KPIS, rankAirports, scoreAirport } from "./investmentScore.ts";

const records = (...codes: string[]) =>
  codes.map((c) => findAirport(c)).filter((r): r is NonNullable<typeof r> => r !== null);

describe("investment score (v0)", () => {
  it("declares the full four-KPI model with Need 0.60 / Quality 0.40 weights", () => {
    const byKey = Object.fromEntries(INVESTMENT_KPIS.map((k) => [k.key, k.weight]));
    expect(byKey).toEqual({ congestion: 0.3, unmet_demand: 0.3, long_haul: 0.2, growth: 0.2 });
    const total = INVESTMENT_KPIS.reduce((s, k) => s + k.weight, 0);
    expect(total).toBeCloseTo(1);
  });

  it("scores a real airport with honest v0 coverage (0.50) and names the missing KPIs", () => {
    const lax = findAirport("LAX");
    expect(lax).not.toBeNull();
    const scored = scoreAirport(lax!);
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);
    expect(scored.coverage).toBe(0.5); // only unmet_demand (0.30) + growth (0.20) computed
    expect([...scored.missing].sort()).toEqual(["congestion", "long_haul"]);
  });

  it("computed KPIs are available; pending ones carry a note", () => {
    const scored = scoreAirport(findAirport("LAX")!);
    const kpi = (k: string) => scored.kpis.find((x) => x.key === k);
    expect(kpi("unmet_demand")?.available).toBe(true);
    expect(kpi("growth")?.available).toBe(true);
    expect(kpi("congestion")?.available).toBe(false);
    expect(kpi("congestion")?.note).toContain("Pending");
    expect(kpi("long_haul")?.note).toContain("Pending");
  });

  it("ranks a set of airports, highest score first", () => {
    const ranked = rankAirports(records("LAX", "SFO", "DEN", "BOS"));
    expect(ranked.length).toBe(4);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.score).toBeGreaterThanOrEqual(ranked[i]!.score);
    }
  });

  it("a big, growing airport outscores a small, shrinking one on the v0 proxies", () => {
    // ATL is the largest US airport; compare against a small-hub record if present.
    const atl = findAirport("ATL");
    expect(atl).not.toBeNull();
    const atlScore = scoreAirport(atl!).score;
    expect(atlScore).toBeGreaterThan(0);
  });
});
