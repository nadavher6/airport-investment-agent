import { describe, expect, it } from "vitest";
import { LIMITS, parseVisual, validateSpec } from "./spec";
import { MAX_TICKS, formatCompact, formatX, niceScale } from "./format";
import { DEMO_FENCES } from "./demo/faaDemo";

const line = { type: "line", title: "LAX", x: "year", unit: "passengers", series: [{ name: "LAX", points: [[2015, 36351272], [2024, 37760834]] }] };
const bar = { type: "bar", title: "Top hubs", unit: "passengers", items: [{ label: "ATL", value: 52511402 }], sort: "desc" };
const table = { title: "LAX vs SNA", columns: ["Airport", "CY2024", "5y CAGR"], rows: [["LAX", 37760834, "-2.5%"]] };
const kpi = { items: [{ label: "LAX CY2024", value: 37760834, unit: "passengers", delta: "-2.5% 5y CAGR" }] };

const reasonOf = (r: ReturnType<typeof validateSpec>): string => (r.ok ? "" : r.reason);

describe("visual spec", () => {
  it("accepts a valid example of each type (the issue's examples)", () => {
    expect(parseVisual("chart", JSON.stringify(line))).toMatchObject({ ok: true, spec: { type: "line" } });
    expect(parseVisual("chart", JSON.stringify(bar))).toMatchObject({ ok: true, spec: { type: "bar" } });
    expect(parseVisual("table", JSON.stringify(table))).toMatchObject({ ok: true, spec: { type: "table" } });
    expect(parseVisual("kpi", JSON.stringify(kpi))).toMatchObject({ ok: true, spec: { type: "kpi" } });
  });

  it("accepts every demo fence", () => {
    for (const f of DEMO_FENCES) expect(parseVisual(f.lang, f.body).ok).toBe(true);
  });

  it("rejects bad JSON with a reason", () => {
    const r = parseVisual("chart", '{"type":"line",');
    expect(r).toEqual({ ok: false, reason: "the spec is not valid JSON" });
  });

  it("rejects a wrong or missing chart type with a reason", () => {
    expect(reasonOf(validateSpec("chart", { ...line, type: "pie" }))).toMatch(/line" or "bar/);
    expect(reasonOf(validateSpec("chart", { series: line.series }))).toMatch(/line" or "bar/);
    expect(reasonOf(validateSpec("chart", [1, 2]))).toMatch(/JSON object/);
    expect(reasonOf(validateSpec("kpi", { ...kpi, type: "line" }))).not.toBe("");
  });

  it("rejects NaN and Infinity with a reason", () => {
    const nan = { ...bar, items: [{ label: "ATL", value: Number.NaN }] };
    const inf = { ...line, series: [{ name: "LAX", points: [[2015, Number.POSITIVE_INFINITY]] }] };
    expect(reasonOf(validateSpec("chart", nan))).toMatch(/items\.0\.value: must be a finite number/);
    expect(reasonOf(validateSpec("chart", inf))).toMatch(/finite number/);
    expect(reasonOf(validateSpec("kpi", { items: [{ label: "x", value: Number.NEGATIVE_INFINITY }] }))).not.toBe("");
  });

  it("rejects over-limit data with a reason", () => {
    const series = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `S${i}`, points: [[1, 1]] }));
    expect(validateSpec("chart", { ...line, series: series(LIMITS.series) }).ok).toBe(true);
    expect(reasonOf(validateSpec("chart", { ...line, series: series(LIMITS.series + 1) }))).toMatch(/^series:/);

    const points = (n: number) => Array.from({ length: n }, (_, i) => [i, i]);
    expect(reasonOf(validateSpec("chart", { ...line, series: [{ name: "A", points: points(LIMITS.points + 1) }] }))).toMatch(
      /series\.0\.points/,
    );

    const items = Array.from({ length: LIMITS.items + 1 }, (_, i) => ({ label: `A${i}`, value: i }));
    expect(reasonOf(validateSpec("chart", { ...bar, items }))).toMatch(/^items:/);

    const columns = Array.from({ length: LIMITS.columns + 1 }, (_, i) => `C${i}`);
    expect(reasonOf(validateSpec("table", { columns, rows: [] }))).toMatch(/^columns:/);

    const rows = Array.from({ length: LIMITS.rows + 1 }, () => ["LAX", 1, "x"]);
    expect(reasonOf(validateSpec("table", { ...table, rows }))).toMatch(/^rows:/);

    const kpis = Array.from({ length: LIMITS.kpiItems + 1 }, (_, i) => ({ label: `K${i}`, value: i }));
    expect(reasonOf(validateSpec("kpi", { items: kpis }))).toMatch(/^items:/);
  });

  it("rejects over-long strings and an oversized body", () => {
    expect(reasonOf(validateSpec("chart", { ...bar, title: "x".repeat(LIMITS.title + 1) }))).toMatch(/^title:/);
    expect(reasonOf(validateSpec("chart", { ...bar, items: [{ label: "x".repeat(LIMITS.label + 1), value: 1 }] }))).toMatch(
      /items\.0\.label/,
    );
    expect(reasonOf(parseVisual("chart", " ".repeat(LIMITS.body + 1)))).toMatch(/longer than/);
  });

  it("rejects a table row whose width does not match the columns", () => {
    expect(reasonOf(validateSpec("table", { ...table, rows: [["LAX", 1]] }))).toBe("rows.0: has 2 cells but there are 3 columns");
  });
});

describe("format", () => {
  it("compacts big numbers and keeps years plain", () => {
    expect(formatCompact(37760834)).toBe("37.8M");
    expect(formatCompact(1284)).toBe("1.3K");
    expect(formatCompact(950)).toBe("950");
    expect(formatX(2015)).toBe("2015");
  });

  it("makes nice ticks that cover the data", () => {
    const s = niceScale([14055777, 53505795], 5, false);
    expect(s.min).toBe(0);
    expect(s.max).toBeGreaterThanOrEqual(53505795);
    expect(s.ticks[0]).toBe(0);
    expect(niceScale([5, 5], 5, false).max).toBeGreaterThan(5);
  });
});

describe("niceScale is bounded", () => {
  const cases: Array<[string, number[]]> = [
    ["1e17 to 1e17+16", Array.from({ length: 17 }, (_, i) => 1e17 + i)],
    ["1e17 and 1e17+16", [1e17, 1e17 + 16]],
    ["-1e308 and 1e308", [-1e308, 1e308]],
    ["all equal", [7, 7, 7]],
    ["all equal zero", [0, 0]],
    ["a single point", [42]],
    ["a single huge point", [1e300]],
    ["empty", []],
  ];
  it.each(cases)("%s: quick, bounded ticks, finite numbers, no throw", (_name, values) => {
    for (const includeZero of [true, false]) {
      const t0 = Date.now();
      const s = niceScale(values, 5, includeZero);
      expect(Date.now() - t0).toBeLessThan(200);
      expect(s.ticks.length).toBeGreaterThan(0);
      expect(s.ticks.length).toBeLessThanOrEqual(MAX_TICKS);
      expect([s.min, s.max, ...s.ticks].every(Number.isFinite)).toBe(true);
      expect(s.min).toBeLessThan(s.max);
    }
  });

  it("caps the tick count even when asked for more", () => {
    expect(niceScale([0, 1e6], 500, true).ticks.length).toBeLessThanOrEqual(MAX_TICKS);
  });

  it("ignores NaN and Infinity instead of looping", () => {
    expect(niceScale([NaN, Infinity, 3], 5, true).ticks.length).toBeLessThanOrEqual(MAX_TICKS);
  });
});

describe("spec magnitude and duplicate x", () => {
  const withValue = (v: number) => JSON.stringify({ ...line, series: [{ name: "A", points: [[2020, v], [2021, 1]] }] });
  it("rejects |value| above 1e15 with a reason, and accepts exactly 1e15", () => {
    const r = parseVisual("chart", withValue(1e17));
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toMatch(/at most/);
    expect(parseVisual("chart", withValue(-1e308)).ok).toBe(false);
    expect(parseVisual("chart", withValue(1e15)).ok).toBe(true);
  });

  it("rejects a line series with duplicate x values, with a reason", () => {
    const dup = { ...line, series: [{ name: "A", points: [[2020, 1], [2020, 2], [2021, 3]] }] };
    const r = parseVisual("chart", JSON.stringify(dup));
    expect(r.ok).toBe(false);
    expect(r.ok ? "" : r.reason).toMatch(/duplicate x/);
  });
});
