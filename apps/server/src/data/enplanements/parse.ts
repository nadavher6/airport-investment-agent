// Turns the rows of one FAA "Commercial Service Enplanements" sheet into typed airport rows.
// Pure: no file or workbook access, so it can be tested with in-memory rows.
import type { HubType, ServiceLevel, YearRow, YearTable } from "./types.ts";

/** A sheet as an array of rows (row 0 = header), as SheetJS `sheet_to_json({ header: 1 })` returns it. */
export type SheetRows = readonly (readonly unknown[])[];

const FILE_YEAR = /cy(\d{4})\.xlsx$/i;

/** Calendar year from a file name like `faa-enplanements-cy2024.xlsx`. */
export function yearFromFileName(fileName: string): number {
  const match = FILE_YEAR.exec(fileName);
  if (!match?.[1]) throw new Error(`cannot read a year from file name "${fileName}"`);
  return Number(match[1]);
}

/** Lower case, single spaces, trimmed: `" CY 24  Enplanements "` -> `"cy 24 enplanements"`. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function twoDigit(year: number): string {
  return String(year % 100).padStart(2, "0");
}

interface Columns {
  readonly rank: number;
  readonly state: number;
  readonly code: number;
  readonly city: number;
  readonly name: number;
  readonly serviceLevel: number;
  readonly hub: number;
  readonly current: number;
  readonly prior: number;
}

/**
 * Finds every needed column by its normalized header. The enplanement columns are picked by
 * year (`CY {yy} Enplanements` and `CY {yy-1} Enplanements`), never by position or by "prior".
 */
export function findColumns(header: readonly unknown[], year: number): Columns {
  const names = header.map(normalizeHeader);
  const find = (wanted: string): number => {
    const index = names.indexOf(wanted);
    if (index < 0) throw new Error(`CY${year}: no "${wanted}" column in header [${names.join(", ")}]`);
    return index;
  };
  return {
    rank: find("rank"),
    state: find("st"),
    code: find("locid"),
    city: find("city"),
    name: find("airport name"),
    serviceLevel: find("s/l"),
    hub: find("hub"),
    current: find(`cy ${twoDigit(year)} enplanements`),
    prior: find(`cy ${twoDigit(year - 1)} enplanements`),
  };
}

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** A whole, non-negative count, or null for blanks. Accepts numbers and digit strings ("1,234"). */
export function toCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 ? value : null;
  if (typeof value === "string") {
    const digits = value.replace(/,/g, "").trim();
    return /^\d+$/.test(digits) ? Number(digits) : null;
  }
  return null;
}

function toServiceLevel(value: unknown): ServiceLevel | null {
  const level = text(value).toUpperCase();
  return level === "P" || level === "CS" ? level : null;
}

/** `L`/`M`/`S`/`N` -> itself; `None`, `-`, blank or anything else -> null. */
export function toHubType(value: unknown): HubType | null {
  const hub = text(value).toUpperCase();
  return hub === "L" || hub === "M" || hub === "S" || hub === "N" ? hub : null;
}

/**
 * Parses one year's sheet. A row is an airport if and only if its `S/L` is `P` or `CS`;
 * that drops the FAA summary block and footnotes at the bottom of the sheet.
 */
export function parseYearSheet(rows: SheetRows, year: number): YearTable {
  const [header, ...body] = rows;
  if (!header) throw new Error(`CY${year}: the sheet is empty`);
  const col = findColumns(header, year);

  const parsed: YearRow[] = [];
  const seen = new Set<string>();
  for (const row of body) {
    const serviceLevel = toServiceLevel(row[col.serviceLevel]);
    if (!serviceLevel) continue;

    const airportCode = text(row[col.code]).toUpperCase();
    if (!airportCode) throw new Error(`CY${year}: airport row without a Locid`);
    if (seen.has(airportCode)) throw new Error(`CY${year}: Locid ${airportCode} appears twice`);
    seen.add(airportCode);

    const enplanements = toCount(row[col.current]);
    if (enplanements === null) throw new Error(`CY${year}: ${airportCode} has no CY${year} enplanements`);

    parsed.push({
      airportCode,
      name: text(row[col.name]),
      city: text(row[col.city]),
      state: text(row[col.state]).toUpperCase(),
      serviceLevel,
      hubType: serviceLevel === "P" ? toHubType(row[col.hub]) : null,
      rank: toCount(row[col.rank]),
      enplanements,
      priorYearEnplanements: toCount(row[col.prior]),
    });
  }
  return { year, rows: parsed };
}
