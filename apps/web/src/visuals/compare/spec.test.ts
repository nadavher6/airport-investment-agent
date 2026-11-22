import { describe, expect, it } from "vitest";
import { COMPARE_DEMO, COMPARE_DEMO_BODY } from "./demo";
import { COMPARE_LIMITS, parseCompare, validateCompare } from "./spec";

type Json = Record<string, unknown>;
const md = (text: string): Json => ({ kind: "markdown", text });
const base = (): Json => ({
  title: "A vs B",
  columns: ["A", "B"],
  rows: [{ label: "Notes", cells: [[md("a")], [md("b")]] }],
});
const reason = (value: unknown): string => {
  const r = validateCompare(value);
  if (r.ok) throw new Error("expected a rejection");
  return r.reason;
};

describe("compare spec", () => {
  it("accepts the LAX vs SNA demo, as JSON text and as a value", () => {
    expect(parseCompare(COMPARE_DEMO_BODY).ok).toBe(true);
    expect(validateCompare(COMPARE_DEMO).ok).toBe(true);
  });

  it("accepts a cell with every block kind, and an empty cell", () => {
    const spec = {
      columns: ["A", "B"],
      rows: [
        {
          label: "Mixed",
          cells: [
            [md("x"), { kind: "kpi", spec: { items: [] } }, { kind: "chart", spec: {} }, { kind: "table", spec: {} }],
            [],
          ],
        },
      ],
    };
    expect(validateCompare(spec).ok).toBe(true);
  });

  it.each([[["A"]], [["A", "B", "C"]], [[]]])("rejects %j columns (exactly 2 for now)", (columns) => {
    const spec = { ...base(), columns, rows: [{ label: "Notes", cells: columns.map(() => [md("x")]) }] };
    expect(reason(spec)).toMatch(/^columns:/);
  });

  it("rejects a row with the wrong number of cells, naming the row", () => {
    const spec = { ...base(), rows: [{ label: "Notes", cells: [[md("a")]] }] };
    expect(reason(spec)).toBe("rows.0.cells: has 1 cells but there are 2 columns");
  });

  it("rejects an unknown block kind", () => {
    const spec = { ...base(), rows: [{ label: "Notes", cells: [[{ kind: "pie", spec: {} }], [md("b")]] }] };
    expect(reason(spec)).toMatch(/^rows\.0\.cells\.0\.0/);
  });

  it(`rejects more than ${COMPARE_LIMITS.rows} rows and accepts exactly ${COMPARE_LIMITS.rows}`, () => {
    const row = { label: "R", cells: [[md("a")], [md("b")]] };
    expect(validateCompare({ ...base(), rows: Array(COMPARE_LIMITS.rows).fill(row) }).ok).toBe(true);
    expect(reason({ ...base(), rows: Array(COMPARE_LIMITS.rows + 1).fill(row) })).toMatch(/^rows:/);
  });

  it(`rejects more than ${COMPARE_LIMITS.blocksPerCell} blocks in a cell`, () => {
    const full = Array(COMPARE_LIMITS.blocksPerCell).fill(md("a"));
    expect(validateCompare({ ...base(), rows: [{ label: "R", cells: [full, [md("b")]] }] }).ok).toBe(true);
    const over = [...full, md("a")];
    expect(reason({ ...base(), rows: [{ label: "R", cells: [over, [md("b")]] }] })).toMatch(/^rows\.0\.cells\.0/);
  });

  it("rejects an over-long markdown block, row label and title", () => {
    const long = (n: number) => "x".repeat(n + 1);
    expect(reason({ ...base(), rows: [{ label: "R", cells: [[md(long(COMPARE_LIMITS.markdown))], []] }] })).toMatch(/text/);
    expect(reason({ ...base(), rows: [{ label: long(60), cells: [[], []] }] })).toMatch(/label/);
    expect(reason({ ...base(), title: long(120) })).toMatch(/^title/);
  });

  it("rejects no rows, a missing spec object, bad JSON and an over-long body", () => {
    expect(reason({ ...base(), rows: [] })).toMatch(/^rows/);
    expect(reason({ ...base(), rows: [{ label: "R", cells: [[{ kind: "kpi" }], []] }] })).toMatch(/spec/);
    expect(parseCompare("{ nope")).toEqual({ ok: false, reason: "the spec is not valid JSON" });
    expect(parseCompare(" ".repeat(100_001)).ok).toBe(false);
  });
});
