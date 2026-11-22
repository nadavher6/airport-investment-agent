// #75: no KPI is relative to anything. An airport's sub-scores and final score come from its own numbers only, so
// they are the same alone, inside any compared set, and with the rest of the dataset reduced or altered.
import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreAirportsTool } from "../agent/tools/scoreAirports.ts";
import { enplanementsDataset, findAirport } from "../data/enplanements/dataset.ts";
import type { AirportRecord } from "../data/enplanements/types.ts";
import type { T100Airport } from "../data/t100/types.ts";
import type { ScoredItem } from "./engine.ts";
import { GROWTH_SCALE, rankAirports, scoreAirport } from "./investmentScore.ts";
import golden from "./fixtures/kpi-golden-main-75.json" with { type: "json" };

/** 20 real airports: big hubs, mid-size, and ones with missing data (2A3: no T-100 and no CAGR; 1G4, FNL, 7AK: no CAGR; 0AK, 16A: no T-100). */
const POOL = ["LAX", "SNA", "ATL", "JFK", "SFO", "DEN", "DFW", "ORD", "MIA", "SEA", "BOS", "LAS", "HNL", "CLT", "A61", "2A3", "1G4", "FNL", "0AK", "16A"] as const;

/** Deterministic PRNG (mulberry32), so the "random" sets are the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` distinct codes from POOL, always containing `must`. */
function subsetWith(rand: () => number, must: string, count: number): string[] {
  const others = POOL.filter((c) => c !== must);
  const picked = new Set<string>([must]);
  while (picked.size < count) picked.add(others[Math.floor(rand() * others.length)]!);
  // Shuffle so `must` is not always first (input order must not matter either).
  return [...picked].map((c) => [rand(), c] as const).sort((x, y) => x[0] - y[0]).map(([, c]) => c);
}

/** Every number that must not depend on the other airports: each sub-score, raw value, contribution, the final score and coverage. */
const fingerprint = (s: ScoredItem<AirportRecord>) => ({
  score: s.score,
  coverage: s.coverage,
  missing: s.missing,
  kpis: s.kpis.map((k) => ({ key: k.key, raw: k.raw, normalized: k.normalized, contribution: k.contribution })),
});

const rec = (code: string): AirportRecord => {
  const r = findAirport(code);
  if (r === null) throw new Error(`${code} is not in the dataset`);
  return r;
};

describe("#75 property: an airport's scores are independent of the comparison set", () => {
  it("the pool resolves to 20 real airports, some with missing data", () => {
    expect(POOL.map((c) => findAirport(c)?.airportCode)).toEqual([...POOL]);
    expect(scoreAirport(rec("2A3")).missing).toEqual(expect.arrayContaining(["unmet_demand", "growth"]));
    expect(scoreAirport(rec("0AK")).missing).toContain("long_haul");
  });

  it("scoring X alone equals scoring X inside 400 seeded random sets of 1-5 airports (every sub-score and the final score)", () => {
    const rand = mulberry32(75);
    const alone = new Map(POOL.map((c) => [c as string, fingerprint(scoreAirport(rec(c)))]));
    let checks = 0;
    for (let i = 0; i < 400; i++) {
      const x = POOL[Math.floor(rand() * POOL.length)]!;
      const set = subsetWith(rand, x, 1 + Math.floor(rand() * 5));
      for (const s of rankAirports(set.map(rec))) {
        expect(fingerprint(s), `${s.item.airportCode} in [${set.join(",")}]`).toEqual(alone.get(s.item.airportCode));
        checks++;
      }
    }
    expect(checks).toBeGreaterThan(1000);
  });

  it("the score_airports tool gives the same sub-scores and final score for X alone and in 100 seeded sets of 2-5", async () => {
    const ctx = { signal: new AbortController().signal };
    type Out = { ranking: { airportCode: string; score: number; breakdown: Record<string, { subScore: number | null }> }[] };
    const run = async (codes: string[]): Promise<Out> => {
      const r = await scoreAirportsTool.run({ airport_codes: codes }, ctx);
      if (!r.ok) throw new Error("expected ok");
      return r.output as unknown as Out;
    };
    const row = (o: Out, code: string) => {
      const a = o.ranking.find((r) => r.airportCode === code)!;
      return { score: a.score, subs: Object.fromEntries(Object.entries(a.breakdown).map(([k, v]) => [k, v.subScore])) };
    };
    const rand = mulberry32(2026);
    for (let i = 0; i < 100; i++) {
      const x = POOL[Math.floor(rand() * POOL.length)]!;
      const set = subsetWith(rand, x, 2 + Math.floor(rand() * 4));
      const many = await run(set);
      for (const code of set) expect(row(many, code), `${code} in [${set.join(",")}]`).toEqual(row(await run([code]), code));
    }
  });
});

describe("#75 property: an airport's scores do not change when the rest of the dataset is reduced or altered", () => {
  afterEach(() => {
    vi.doUnmock("../data/enplanements/dataset.ts");
    vi.doUnmock("../data/t100/dataset.ts");
    vi.resetModules();
  });

  /** Re-imports the scorer with the enplanements and T-100 datasets replaced (a fresh module graph). */
  async function scorerWith(
    airports: Record<string, AirportRecord>,
    t100: (code: string, real: T100Airport | null) => T100Airport | null,
  ) {
    vi.resetModules();
    const realEnpl = await vi.importActual<typeof import("../data/enplanements/dataset.ts")>("../data/enplanements/dataset.ts");
    const realT = await vi.importActual<typeof import("../data/t100/dataset.ts")>("../data/t100/dataset.ts");
    vi.doMock("../data/enplanements/dataset.ts", () => ({
      enplanementsDataset: { ...realEnpl.enplanementsDataset, airports },
      findAirport: (code: string) => airports[code.trim().toUpperCase()] ?? null,
    }));
    vi.doMock("../data/t100/dataset.ts", () => ({
      t100Dataset: realT.t100Dataset,
      getT100: (code: unknown) => (typeof code === "string" ? t100(code.trim().toUpperCase(), realT.getT100(code)) : null),
    }));
    return import("./investmentScore.ts");
  }

  const KEEP = ["LAX", "SNA", "ATL", "JFK", "SFO", "DEN", "DFW", "ORD", "2A3", "FNL"];

  it("LAX, SNA, ATL, JFK, SFO, 2A3 score the same with the dataset reduced to 10 airports", async () => {
    const reduced = Object.fromEntries(KEEP.map((c) => [c, rec(c)]));
    const mod = await scorerWith(reduced, (code, real) => (KEEP.includes(code) ? real : null));
    for (const c of ["LAX", "SNA", "ATL", "JFK", "SFO", "2A3"]) {
      expect(fingerprint(mod.scoreAirport(reduced[c]!)), c).toEqual(fingerprint(scoreAirport(rec(c))));
      expect(fingerprint(mod.rankAirports(KEEP.map((k) => reduced[k]!)).find((s) => s.item.airportCode === c)!), c).toEqual(fingerprint(scoreAirport(rec(c))));
    }
  });

  it("LAX scores the same when every OTHER airport's CAGR and T-100 numbers are mutated (and extra airports added)", async () => {
    const mutated: Record<string, AirportRecord> = {};
    for (const [code, a] of Object.entries(enplanementsDataset.airports)) {
      mutated[code] = code === "LAX" ? a : { ...a, trend: { ...a.trend, cagr5yr: a.trend.cagr5yr === null ? 42 : a.trend.cagr5yr * -7 + 13 } };
    }
    for (let i = 0; i < 30; i++) {
      const lax = rec("LAX");
      mutated[`ZZ${i}`] = { ...lax, airportCode: `ZZ${i}`, trend: { ...lax.trend, cagr5yr: i * 3 - 40 } };
    }
    const mod = await scorerWith(mutated, (code, real) =>
      code === "LAX" || real === null ? real : { ...real, loadFactor: real.loadFactor / 2, internationalShare: 100 - real.internationalShare },
    );
    const set = ["LAX", "SNA", "JFK", "ZZ0", "ZZ29"].map((c) => mutated[c]!);
    const want = fingerprint(scoreAirport(rec("LAX")));
    expect(fingerprint(mod.scoreAirport(mutated.LAX!))).toEqual(want);
    expect(fingerprint(mod.rankAirports(set).find((s) => s.item.airportCode === "LAX")!)).toEqual(want);
    expect(fingerprint(mod.rankAirports(Object.values(mutated)).find((s) => s.item.airportCode === "LAX")!)).toEqual(want);
    // The mutation did reach the other airports (so the test can fail): SNA's growth moved.
    const sna = (s: ScoredItem<AirportRecord>) => s.kpis.find((k) => k.key === "growth")!.normalized;
    expect(sna(mod.scoreAirport(mutated.SNA!))).not.toBe(sna(scoreAirport(rec("SNA"))));
  });
});

describe("#75 golden vs main (recorded on main df10d78 before the change, fixtures/kpi-golden-main-75.json)", () => {
  type Row = { congestion: number | null; unmet_demand: number | null; long_haul: number | null; growth: number | null; score: number };
  const main = golden.absolute as Record<string, Row>;
  const sub = (s: ScoredItem<AirportRecord>, key: string) => s.kpis.find((k) => k.key === key)!.normalized;

  it("congestion, unmet demand and long-haul are unchanged for every airport", () => {
    const all = Object.values(enplanementsDataset.airports);
    expect(Object.keys(main).sort()).toEqual(all.map((a) => a.airportCode).sort());
    for (const a of all) {
      const s = scoreAirport(a);
      const m = main[a.airportCode]!;
      expect({ congestion: sub(s, "congestion"), unmet_demand: sub(s, "unmet_demand"), long_haul: sub(s, "long_haul") }, a.airportCode).toEqual({
        congestion: m.congestion,
        unmet_demand: m.unmet_demand,
        long_haul: m.long_haul,
      });
    }
  });

  it("growth moves from min-max to 50 + 5 x CAGR (clamped), missing stays missing; LAX 44.1 alone / 0 in 5 hubs on main -> 37.3 everywhere", () => {
    expect(GROWTH_SCALE).toEqual({ kind: "linear", zeroAt: -10, fullAt: 10 });
    for (const a of Object.values(enplanementsDataset.airports)) {
      const g = sub(scoreAirport(a), "growth");
      const cagr = a.trend.cagr5yr;
      if (cagr === null) {
        expect(g, a.airportCode).toBeNull();
        expect(main[a.airportCode]!.growth, a.airportCode).toBeNull();
      } else expect(g, a.airportCode).toBe(Math.round(Math.min(100, Math.max(0, 50 + 5 * cagr)) * 10) / 10);
    }
    const before = golden.relativeFiveHubsBefore as Record<string, Row>;
    expect([main.LAX!.growth, before.LAX!.growth]).toEqual([44.1, 0]); // the bug, as recorded on main
    const hubs = rankAirports(["LAX", "DEN", "DFW", "ORD", "ATL"].map(rec));
    expect(sub(hubs.find((s) => s.item.airportCode === "LAX")!, "growth")).toBe(37.3);
    expect(sub(scoreAirport(rec("LAX")), "growth")).toBe(37.3);
  });
});
