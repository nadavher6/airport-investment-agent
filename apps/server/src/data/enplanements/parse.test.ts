import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { findColumns, normalizeHeader, parseYearSheet, toCount, toHubType, yearFromFileName } from "./parse.ts";
import { readFirstSheet } from "./workbook.ts";

const HEADER = [
  "Rank", "RO", "ST", "Locid", "City", "Airport Name", "S/L", "Hub",
  "CY 20 Enplanements", "CY 19 Enplanements", "% Change",
];

// A tiny CY2020-style sheet: two airports, a summary row (count in Locid) and a footnote.
const CY2020_ROWS: unknown[][] = [
  HEADER,
  [1, "SO", "GA", "ATL", "Atlanta", "Hartsfield - Jackson Atlanta International", "P", "L", 20559866, 53505795, -0.6157],
  [478, "GL", "MI", "IWD", "Ironwood", "Gogebic-Iron County", "CS", "-", 2541, 5121, -0.5038],
  [500, "AL", "AK", "W33", "Friday Harbor", "Friday Harbor", "CS", "None", 2555, null, null],
  [null, null, null, 107, null, "Nonprimary, Commercial Service", " ", " ", null, null, null],
  [" ", " ", " ", " ", 522, "Total Commercial Service ", " ", " ", " ", " ", " "],
  ["Footnote: hub categories are based on COVID-depressed traffic.", null, null, null, null, null, null, null, null, null, null],
];

describe("parseYearSheet", () => {
  const table = parseYearSheet(CY2020_ROWS, 2020);

  it("keeps only rows whose S/L is P or CS (summary and footnote rows are dropped)", () => {
    expect(table.year).toBe(2020);
    expect(table.rows.map((row) => row.airportCode)).toEqual(["ATL", "IWD", "W33"]);
  });

  it("maps the None and - hub values of CS rows to null, never the string", () => {
    expect(table.rows.map((row) => row.hubType)).toEqual(["L", null, null]);
  });

  it("reads the current and prior figures from the year-matched columns", () => {
    expect(table.rows[0]).toMatchObject({ enplanements: 20559866, priorYearEnplanements: 53505795, rank: 1 });
    expect(table.rows[2]).toMatchObject({ enplanements: 2555, priorYearEnplanements: null });
  });

  it("takes name, city and state from the row", () => {
    expect(table.rows[1]).toMatchObject({ name: "Gogebic-Iron County", city: "Ironwood", state: "MI", serviceLevel: "CS" });
  });

  it("matches enplanement columns by year, not position or the word prior", () => {
    // Prior year first and extra spaces in the headers: still CY 24 = current, CY 23 = prior.
    const rows = [
      ["CY 23  Enplanements", "Locid", " Rank ", "ST", "City", "Airport Name", "S/L", "Hub", "cy 24 enplanements"],
      [50950068, "ATL", 1, "GA", "Atlanta", "ATL Intl", "P", "L", 52511402],
    ];
    expect(parseYearSheet(rows, 2024).rows[0]).toMatchObject({ enplanements: 52511402, priorYearEnplanements: 50950068 });
  });

  it("fails loudly when the year's column is missing (wrong file for the year)", () => {
    expect(() => parseYearSheet(CY2020_ROWS, 2021)).toThrow(/cy 21 enplanements/);
  });

  it("fails on an airport row without a current-year figure, instead of inventing one", () => {
    const rows = [HEADER, [1, "SO", "GA", "ATL", "Atlanta", "X", "P", "L", null, 1, 0]];
    expect(() => parseYearSheet(rows, 2020)).toThrow(/ATL has no CY2020/);
  });
});

describe("helpers", () => {
  it("yearFromFileName reads the 4-digit year", () => {
    expect(yearFromFileName("faa-enplanements-cy2024.xlsx")).toBe(2024);
    expect(() => yearFromFileName("SOURCES.md")).toThrow();
  });

  it("normalizeHeader lower-cases and collapses spaces", () => {
    expect(normalizeHeader("  CY 24   Enplanements ")).toBe("cy 24 enplanements");
  });

  it("toCount accepts whole numbers and digit strings only", () => {
    expect(toCount(2555)).toBe(2555);
    expect(toCount("1,234")).toBe(1234);
    expect(toCount(" ")).toBeNull();
    expect(toCount(null)).toBeNull();
    expect(toCount(0.05)).toBeNull();
  });

  it("toHubType keeps L/M/S/N only", () => {
    expect(["L", "M", "S", "N", "None", "-", " ", null].map(toHubType)).toEqual(["L", "M", "S", "N", null, null, null, null]);
  });

  it("toHubType throws on an unknown value instead of passing it through as null", () => {
    expect(() => toHubType("X")).toThrow(/unknown Hub value "X"/);
    expect(() => toHubType("Large")).toThrow(/unknown Hub value/);
  });

  it("parseYearSheet fails the build on an unknown Hub value of a primary airport", () => {
    const rows = CY2020_ROWS.map((r) => (r[3] === "ATL" ? r.map((cell, i) => (i === 7 ? "X" : cell)) : r));
    expect(() => parseYearSheet(rows, 2020)).toThrow(/CY2020: ATL: unknown Hub value "X"/);
  });

  it("findColumns reports the header it saw when a column is missing", () => {
    expect(() => findColumns(["Locid"], 2020)).toThrow(/no "rank" column/);
  });
});

describe("readFirstSheet", () => {
  it("reads only the first sheet of an in-memory workbook", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(CY2020_ROWS), "CY 20 Enplanements ");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["other"]]), "Sheet1");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const rows = readFirstSheet(new Uint8Array(bytes));
    expect(rows[0]).toEqual(HEADER);
    expect(parseYearSheet(rows, 2020).rows.map((row) => row.airportCode)).toEqual(["ATL", "IWD", "W33"]);
  });
});
