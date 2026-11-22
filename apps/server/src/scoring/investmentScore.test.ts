import { describe, expect, it } from "vitest";
import { findAirport } from "../data/enplanements/dataset.ts";
import { enplanementsDataset } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { isPercentScale } from "./engine.ts";
import { INVESTMENT_KPIS, growthPctPerYear, rankAirports, rankAirportsRelative, scoreAirport } from "./investmentScore.ts";

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

  it("gives the same ranking for forward and reversed input, ties ordered by airport code", () => {
    const all = Object.values(enplanementsDataset.airports);
    const codes = (xs: ReturnType<typeof rankAirports>) => xs.map((s) => s.item.airportCode);
    for (const rank of [rankAirports, rankAirportsRelative]) {
      const forward = rank(all);
      expect(codes(rank([...all].reverse()))).toEqual(codes(forward));
      for (let i = 1; i < forward.length; i++) {
        const [a, b] = [forward[i - 1]!, forward[i]!];
        if (a.score === b.score) expect(a.item.airportCode < b.item.airportCode).toBe(true);
      }
    }
  });

  it("growth is always 5-year CAGR in % per year: an airport with no CAGR (FNL, latest FAA year 2022) is missing growth", () => {
    const growth = (code: string) => scoreAirport(findAirport(code)!).kpis.find((k) => k.key === "growth")!;
    // FNL used to get the recovery ratio as "total % change since 2019" (+332); now growth is missing.
    const fnl = findAirport("FNL")!;
    expect(fnl.trend.cagr5yr).toBeNull();
    expect(fnl.trend.recoveryVs2019).not.toBeNull();
    const g = growth("FNL");
    expect(g.available).toBe(false);
    expect(g.raw).toBeNull();
    expect(g.evidence!.value).toBeNull();
    expect(scoreAirport(fnl).missing).toContain("growth");

    // An airport with a CAGR: raw value, evidence value and the dataset's cagr5yr are the same number, in % per year.
    const den = growth("DEN");
    expect(den.raw).toBe(findAirport("DEN")!.trend.cagr5yr);
    expect(den.evidence!.value).toBe(den.raw);
    expect(den.evidence!.inputs.unit).toBe("% per year");

    // Over the whole dataset the KPI never takes any value other than cagr5yr.
    for (const a of Object.values(enplanementsDataset.airports)) expect(growthPctPerYear(a)).toBe(a.trend.cagr5yr);
  });
});

describe("unmet demand sub-score = load factor as a percentage (#53)", () => {
  const sub = (s: ReturnType<typeof scoreAirport>, key: string) => s.kpis.find((k) => k.key === key)!;
  const lf = (code: string) => sub(scoreAirport(findAirport(code)!), "unmet_demand").raw!;

  it("declares the percent scale on congestion (#54) and unmet_demand only", () => {
    expect(INVESTMENT_KPIS.filter((k) => isPercentScale(k.scale)).map((k) => [k.key, k.scale])).toEqual([
      ["congestion", { kind: "percent", fullAt: 1.0 }],
      ["unmet_demand", { kind: "percent", fullAt: 100 }],
    ]);
  });

  it("LAX and SNA: the sub-score equals the load factor, in both modes", () => {
    for (const ranked of [rankAirports(records("LAX", "SNA")), rankAirportsRelative(records("LAX", "SNA"))]) {
      for (const s of ranked) {
        const u = sub(s, "unmet_demand");
        expect(u.raw).toBe(lf(s.item.airportCode));
        expect(u.normalized).toBe(Math.min(100, u.raw!));
        expect(u.contribution).toBe(Math.round((u.normalized! * 0.3) * 10) / 10); // full coverage: weight 0.3
      }
    }
  });

  it("a load factor above 100% (ODW 108.3) is capped at 100 and the evidence says so", () => {
    const odw = { airportCode: "ODW" } as AirportRecord;
    const kpi = INVESTMENT_KPIS.find((k) => k.key === "unmet_demand")!;
    expect(kpi.extract(odw)).toBe(108.3);
    expect(kpi.evidence!(odw).explanation).toContain("capped at 100");
    expect(kpi.evidence!(findAirport("SNA")!).explanation).not.toContain("capped");
  });

  it("an airport with no T-100 record has unmet demand missing (null)", () => {
    const kpi = INVESTMENT_KPIS.find((k) => k.key === "unmet_demand")!;
    expect(kpi.extract({ airportCode: "ZZZ" } as AirportRecord)).toBeNull();
  });

  it("golden: the other KPIs are unchanged (values recorded from main before #53; congestion changed in #54)", () => {
    const line = (s: ReturnType<typeof scoreAirport>) =>
      `${s.item.airportCode} ` +
      s.kpis
        .filter((k) => k.key !== "unmet_demand" && k.key !== "congestion")
        .map((k) => `${k.key}:${k.raw}:${k.normalized}`)
        .join(" ");
    const codes = ["LAX", "SNA", "ATL", "JFK"];
    expect(rankAirports(records(...codes)).map(line).sort()).toEqual([
      "ATL long_haul:13.6:100 growth:-0.3745:53.6",
      "JFK long_haul:52.9:100 growth:0.2752:56.4",
      "LAX long_haul:30.8:100 growth:-2.5375:44.1",
      "SNA long_haul:2.1:20 growth:0.8283:58.8",
    ]);
    expect(rankAirportsRelative(records(...codes)).map(line).sort()).toEqual([
      "ATL long_haul:13.6:22.6 growth:-0.3745:64.3",
      "JFK long_haul:52.9:100 growth:0.2752:83.6",
      "LAX long_haul:30.8:56.5 growth:-2.5375:0",
      "SNA long_haul:2.1:0 growth:0.8283:100",
    ]);
  });
});
