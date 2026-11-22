import { describe, expect, it } from "vitest";
import { buildScorer, normalize, type KpiDef } from "./engine.ts";

describe("normalize", () => {
  const bounds = { lo: 0, hi: 100 };
  it("maps to 0-100 within winsor bounds (higher = better)", () => {
    expect(normalize(0, bounds, "higher")).toBe(0);
    expect(normalize(100, bounds, "higher")).toBe(100);
    expect(normalize(50, bounds, "higher")).toBe(50);
  });
  it("inverts for a 'lower is better' KPI", () => {
    expect(normalize(0, bounds, "lower")).toBe(100);
    expect(normalize(100, bounds, "lower")).toBe(0);
  });
  it("clamps outliers to the winsor bounds", () => {
    expect(normalize(999, bounds, "higher")).toBe(100);
    expect(normalize(-999, bounds, "higher")).toBe(0);
  });
  it("returns neutral 50 for a degenerate (flat) range", () => {
    expect(normalize(42, { lo: 7, hi: 7 }, "higher")).toBe(50);
  });
});

interface Row {
  readonly a: number;
  readonly b: number | null;
}

const kpis: KpiDef<Row>[] = [
  { key: "a", label: "A", weight: 0.75, direction: "higher", extract: (r) => r.a },
  { key: "b", label: "B", weight: 0.25, direction: "higher", note: "sometimes missing", extract: (r) => r.b },
];

describe("buildScorer", () => {
  const reference: Row[] = [
    { a: 0, b: 0 },
    { a: 50, b: 50 },
    { a: 100, b: 100 },
  ];
  const scorer = buildScorer(reference, kpis, { winsor: [0, 100] });

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
