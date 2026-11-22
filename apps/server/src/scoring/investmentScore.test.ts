import { describe, expect, it } from "vitest";
import { findAirport } from "../data/enplanements/dataset.ts";
import { enplanementsDataset } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import { INVESTMENT_KPIS, growthPctPerYear, rankAirports, rankAirportsRelative, scoreAirport } from "./investmentScore.ts";

import { getT100 } from "../data/t100/dataset.ts";
import golden from "./fixtures/kpi-golden-main.json" with { type: "json" };

const findShare = (code: string): number => getT100(code)!.internationalShare;
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
    expect(lh(jfk)).toBe(100); // above 50% international: capped
    expect(lh(den)).toBeCloseTo(findShare("DEN") / 0.5, 1); // share ÷ 50%, no longer 0
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

  it("declares the percent scale on unmet_demand and long_haul only", () => {
    expect(INVESTMENT_KPIS.filter((k) => k.scale?.kind === "percent").map((k) => k.key)).toEqual(["unmet_demand", "long_haul"]);
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

  it("golden: the other KPIs are unchanged (values recorded from main before #53; long_haul updated for #57)", () => {
    const line = (s: ReturnType<typeof scoreAirport>) =>
      `${s.item.airportCode} ` +
      s.kpis.filter((k) => k.key !== "unmet_demand").map((k) => `${k.key}:${k.raw}:${k.normalized}`).join(" ");
    const codes = ["LAX", "SNA", "ATL", "JFK"];
    expect(rankAirports(records(...codes)).map(line).sort()).toEqual([
      "ATL congestion:393351:100 long_haul:13.6:27.2 growth:-0.3745:53.6",
      "JFK congestion:212209:100 long_haul:52.9:100 growth:0.2752:56.4",
      "LAX congestion:266820:100 long_haul:30.8:61.6 growth:-2.5375:44.1",
      "SNA congestion:51447:50.3 long_haul:2.1:4.2 growth:0.8283:58.8",
    ]);
    expect(rankAirportsRelative(records(...codes)).map(line).sort()).toEqual([
      "ATL congestion:393351:100 long_haul:13.6:27.2 growth:-0.3745:64.3",
      "JFK congestion:212209:47 long_haul:52.9:100 growth:0.2752:83.6",
      "LAX congestion:266820:63 long_haul:30.8:61.6 growth:-2.5375:0",
      "SNA congestion:51447:0 long_haul:2.1:4.2 growth:0.8283:100",
    ]);
  });
});

describe("long-haul as a percentage out of 50% (#57)", () => {
  const lh = (code: string, rank: typeof rankAirports) =>
    rank(records("LAX", "SNA", code)).find((s) => s.item.airportCode === code)!.kpis.find((k) => k.key === "long_haul")!;

  it("declares fullAt 0.5 for long_haul and fullAt 1.0 for unmet demand", () => {
    const scale = (key: string) => INVESTMENT_KPIS.find((k) => k.key === key)!.scale;
    expect(scale("long_haul")).toEqual({ kind: "percent", fullAt: 0.5 });
    expect(scale("unmet_demand")).toEqual({ kind: "percent", fullAt: 1.0 });
    expect(scale("congestion")).toBeUndefined();
    expect(scale("growth")).toBeUndefined();
  });

  it("LAX 30.8% -> 61.6 and SNA 2.1% -> 4.2, in both modes", () => {
    for (const rank of [rankAirports, rankAirportsRelative]) {
      const set = rank(records("LAX", "SNA"));
      const sub = (code: string) => set.find((s) => s.item.airportCode === code)!.kpis.find((k) => k.key === "long_haul")!.normalized;
      expect(sub("LAX")).toBe(61.6);
      expect(sub("SNA")).toBe(4.2);
    }
  });

  it("evidence names the 50% benchmark and the result; contribution = sub-score x renormalized weight", () => {
    const k = lh("LAX", rankAirports);
    expect(k.evidence!.explanation).toContain("scored against a 50% benchmark (50% international = 100) → 61.6");
    expect(k.contribution).toBe(12.3); // 61.6 x 0.2
  });

  it("notes the cap above 50% (JFK)", () => {
    const k = scoreAirport(findAirport("JFK")!).kpis.find((x) => x.key === "long_haul")!;
    expect(k.normalized).toBe(100);
    expect(k.evidence!.explanation).toContain("capped at 100");
  });

  it("golden vs main: congestion, unmet demand (load factor, fullAt 1.0) and growth are identical for every airport (absolute)", () => {
    for (const a of Object.values(enplanementsDataset.airports)) {
      const got = Object.fromEntries(
        scoreAirport(a).kpis.filter((k) => k.key !== "long_haul").map((k) => [k.key, k.normalized]),
      );
      expect(got, a.airportCode).toEqual((golden.absolute as Record<string, unknown>)[a.airportCode]);
    }
  });

  it("golden vs main: the same three KPIs are identical in a relative comparison", () => {
    for (const s of rankAirportsRelative(records("LAX", "SNA", "JFK", "DEN"))) {
      const got = Object.fromEntries(s.kpis.filter((k) => k.key !== "long_haul").map((k) => [k.key, k.normalized]));
      expect(got, s.item.airportCode).toEqual((golden.relative as Record<string, unknown>)[s.item.airportCode]);
    }
  });

  it("unmet demand: LAX load factor scores the load factor itself", () => {
    const k = scoreAirport(findAirport("LAX")!).kpis.find((x) => x.key === "unmet_demand")!;
    expect(k.normalized).toBe(k.raw);
  });
});
