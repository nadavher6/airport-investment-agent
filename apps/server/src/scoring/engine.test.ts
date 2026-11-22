import { describe, expect, it } from "vitest";
import { buildScorer, linearScore, percentScore, type KpiDef, type Scale } from "./engine.ts";

/** A 0..100 linear scale: the raw value is the sub-score (clamped), for the generic engine tests. */
const UNIT: Scale = { kind: "linear", zeroAt: 0, fullAt: 100 };

describe("linearScore (#75: a fixed scale on the item's own value)", () => {
  it("scores 0 at zeroAt, 100 at fullAt, linearly in between (higher = better)", () => {
    expect(linearScore(0, "higher", 0, 100)).toBe(0);
    expect(linearScore(100, "higher", 0, 100)).toBe(100);
    expect(linearScore(50, "higher", 0, 100)).toBe(50);
  });
  it("growth's scale (zeroAt -10, fullAt 10): 50 + 5 x CAGR, so -2.5 -> 37.5, 3.6 -> 68, 0 -> 50", () => {
    expect(linearScore(-2.5, "higher", -10, 10)).toBe(37.5);
    expect(linearScore(3.6, "higher", -10, 10)).toBe(68);
    expect(linearScore(0, "higher", -10, 10)).toBe(50);
    expect(linearScore(-10, "higher", -10, 10)).toBe(0);
    expect(linearScore(10, "higher", -10, 10)).toBe(100);
  });
  it("inverts for a 'lower is better' KPI", () => {
    expect(linearScore(0, "lower", 0, 100)).toBe(100);
    expect(linearScore(100, "lower", 0, 100)).toBe(0);
  });
  it("clamps outside the scale", () => {
    expect(linearScore(999, "higher", 0, 100)).toBe(100);
    expect(linearScore(-999, "higher", 0, 100)).toBe(0);
    expect(linearScore(-45, "higher", -10, 10)).toBe(0);
    expect(linearScore(25, "higher", -10, 10)).toBe(100);
  });
  it("NaN, ±Infinity and a degenerate scale are missing (null)", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(linearScore(bad, "higher", -10, 10)).toBeNull();
    expect(linearScore(1, "higher", 7, 7)).toBeNull();
  });
});

interface Row {
  readonly a: number;
  readonly b: number | null;
}

const kpis: KpiDef<Row>[] = [
  { key: "a", label: "A", weight: 0.75, direction: "higher", scale: UNIT, extract: (r) => r.a },
  { key: "b", label: "B", weight: 0.25, direction: "higher", scale: UNIT, note: "sometimes missing", extract: (r) => r.b },
];

describe("buildScorer", () => {
  const reference: Row[] = [
    { a: 0, b: 0 },
    { a: 50, b: 50 },
    { a: 100, b: 100 },
  ];
  const scorer = buildScorer(kpis);

  it("scores and ranks on a fixed scale", () => {
    const ranked = scorer.rank(reference);
    expect(ranked.map((r) => r.item.a)).toEqual([100, 50, 0]);
    expect(ranked[0]?.score).toBe(100);
    expect(ranked[0]?.coverage).toBe(1);
  });

  it("renormalizes weights over available KPIs and reports coverage + missing", () => {
    // b missing -> only a (weight .75) available -> renormalized to 1.0, coverage .75
    const scored = scorer.score({ a: 100, b: null });
    expect(scored.coverage).toBe(0.75);
    expect(scored.missing).toEqual(["b"]);
    expect(scored.score).toBe(100); // a alone, renormalized
    const aKpi = scored.kpis.find((k) => k.key === "a");
    expect(aKpi?.available).toBe(true);
    expect(scored.kpis.find((k) => k.key === "b")?.available).toBe(false);
  });

  it("exposes per-KPI raw, normalized, and contribution", () => {
    const scored = scorer.score({ a: 50, b: 100 });
    const a = scored.kpis.find((k) => k.key === "a");
    expect(a?.raw).toBe(50);
    expect(a?.normalized).toBe(50);
    // contributions sum to the score
    const sum = scored.kpis.reduce((s, k) => s + (k.contribution ?? 0), 0);
    expect(Math.round(sum * 10) / 10).toBe(scored.score);
  });
});

describe("rank tie-break", () => {
  interface Tied {
    readonly code: string;
    readonly v: number;
  }
  const kpi: KpiDef<Tied> = { key: "v", label: "v", weight: 1, direction: "higher", scale: UNIT, extract: (r) => r.v };
  // C and A tie at the top, D and B tie at the bottom.
  const items: Tied[] = [
    { code: "C", v: 10 },
    { code: "D", v: 0 },
    { code: "A", v: 10 },
    { code: "B", v: 0 },
  ];

  it("orders by score descending, then the tie-break key ascending, for forward and reversed input", () => {
    const scorer = buildScorer([kpi], { tieBreak: (r) => r.code });
    const forward = scorer.rank(items).map((s) => s.item.code);
    const reversed = scorer.rank([...items].reverse()).map((s) => s.item.code);
    expect(forward).toEqual(["A", "C", "B", "D"]);
    expect(reversed).toEqual(forward);
  });
});

describe("scale: percent", () => {
  interface P {
    readonly id: string;
    readonly pct: number | null;
    readonly other: number;
  }
  const pk: KpiDef<P>[] = [
    { key: "pct", label: "Pct", weight: 0.5, direction: "higher", scale: { kind: "percent", fullAt: 1.0 }, extract: (r) => r.pct },
    { key: "other", label: "Other", weight: 0.5, direction: "higher", scale: UNIT, extract: (r) => r.other },
  ];
  const rows: P[] = [
    { id: "A", pct: 81.7, other: 10 },
    { id: "B", pct: 73.8, other: 20 },
    { id: "C", pct: 108.3, other: 30 },
    { id: "D", pct: null, other: 40 },
  ];
  const sub = (s: { kpis: readonly { key: string; normalized: number | null }[] }, key: string) =>
    s.kpis.find((k) => k.key === key)?.normalized;

  it("the sub-score is the percentage itself", () => {
    expect(percentScore(0.817, "higher", 1)).toBe(81.7);
    expect(percentScore(0.738, "higher", 1)).toBe(73.8);
    expect(percentScore(0, "higher", 1)).toBe(0);
  });

  it("caps at 100 and clamps below 0 to 0", () => {
    expect(percentScore(1.083, "higher", 1)).toBe(100);
    expect(percentScore(-0.05, "higher", 1)).toBe(0);
  });

  it("inverts for direction lower", () => {
    expect(percentScore(0.817, "lower", 1)).toBe(18.3);
  });

  it("runway utilization (#54): a raw value in percent points, fullAt 1.0: 86.8% -> 86.8, 205% -> 100", () => {
    expect(percentScore(0.868, "higher", 1.0)).toBe(86.8);
    expect(percentScore(2.05, "higher", 1.0)).toBe(100);
    expect(percentScore(0.5, "higher", 0)).toBeNull(); // a fullAt that is not positive is unusable
    // Through the engine, which divides the raw percent by 100: a 100x unit slip would give 100 or 0.9.
    const u: KpiDef<{ readonly util: number }>[] = [
      { key: "util", label: "Util", weight: 1, direction: "higher", scale: { kind: "percent", fullAt: 1.0 }, extract: (r) => r.util },
    ];
    const s = buildScorer(u);
    expect(s.score({ util: 86.8 }).kpis[0]!.normalized).toBe(86.8);
    expect(s.score({ util: 205 }).kpis[0]!.normalized).toBe(100);
  });

  it("percentScore treats NaN, +Infinity and -Infinity as missing (null)", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(percentScore(bad, "higher", 1)).toBeNull();
      expect(percentScore(bad, "lower", 1)).toBeNull();
    }
  });

  it("null is missing, as before: weight renormalized, listed in missing", () => {
    const s = buildScorer(pk).score(rows[3] as P);
    expect(s.missing).toEqual(["pct"]);
    expect(sub(s, "pct")).toBeNull();
    expect(s.coverage).toBe(0.5);
  });

  it("contribution = sub-score x renormalized weight", () => {
    const s = buildScorer(pk).score(rows[0] as P);
    expect(s.kpis.find((k) => k.key === "pct")?.contribution).toBe(40.9); // 81.7 x 0.5 = 40.85 -> 40.9
  });

  it("is deterministic: same input, same output and order, ties by key", () => {
    const tied: P[] = [
      { id: "B", pct: 50, other: 1 },
      { id: "A", pct: 50, other: 1 },
    ];
    const sc = buildScorer(pk, { tieBreak: (r) => r.id });
    const ids = (xs: P[]) => sc.rank(xs).map((s) => s.item.id);
    expect(ids(tied)).toEqual(["A", "B"]);
    expect(ids([...tied].reverse())).toEqual(["A", "B"]);
    expect(sc.rank(tied)).toEqual(sc.rank(tied));
  });
});

describe("scale: percent with fullAt 0.5 (long-haul)", () => {
  interface L {
    readonly id: string;
    readonly intl: number | null;
    readonly other: number;
  }
  const lk: KpiDef<L>[] = [
    { key: "intl", label: "Intl", weight: 0.5, direction: "higher", scale: { kind: "percent", fullAt: 0.5 }, extract: (r) => r.intl },
    { key: "other", label: "Other", weight: 0.5, direction: "higher", scale: UNIT, extract: (r) => r.other },
  ];
  const rows: L[] = [
    { id: "A", intl: 40, other: 1 },
    { id: "B", intl: 30.8, other: 2 },
    { id: "C", intl: 2.1, other: 3 },
    { id: "D", intl: 65, other: 4 },
    { id: "E", intl: null, other: 5 },
    { id: "F", intl: Number.NaN, other: 6 },
  ];
  const sub = (s: { kpis: readonly { key: string; normalized: number | null }[] }) =>
    s.kpis.find((k) => k.key === "intl")?.normalized;

  it("share / fullAt x 100: 0.40 -> 80, 0.308 -> 61.6, 0.021 -> 4.2, 0.5 -> 100", () => {
    expect(percentScore(0.4, "higher", 0.5)).toBe(80);
    expect(percentScore(0.308, "higher", 0.5)).toBe(61.6);
    expect(percentScore(0.021, "higher", 0.5)).toBe(4.2);
    expect(percentScore(0.5, "higher", 0.5)).toBe(100);
  });

  it("caps at 100 above fullAt (0.6 -> 100)", () => {
    expect(percentScore(0.6, "higher", 0.5)).toBe(100);
  });

  it("null and NaN are missing", () => {
    expect(percentScore(Number.NaN, "higher", 0.5)).toBeNull();
    const sc = buildScorer(lk);
    for (const r of [rows[4], rows[5]] as L[]) {
      const s = sc.score(r);
      expect(s.missing).toEqual(["intl"]);
      expect(sub(s)).toBeNull();
      expect(s.coverage).toBe(0.5);
    }
  });

  it("the engine reads the raw value in percent points: 40 -> 80, 30.8 -> 61.6, 65 -> 100", () => {
    const sc = buildScorer(lk);
    expect([0, 1, 2, 3].map((i) => sub(sc.score(rows[i] as L)))).toEqual([80, 61.6, 4.2, 100]);
  });

  it("long_haul scale: 0% scores 0 and exactly 50% scores 100 through the engine", () => {
    const edge: L[] = [
      { id: "Z", intl: 0, other: 1 },
      { id: "H", intl: 50, other: 2 },
    ];
    const sc = buildScorer(lk);
    expect(sub(sc.score(edge[0] as L))).toBe(0);
    expect(sub(sc.score(edge[1] as L))).toBe(100);
  });
});
