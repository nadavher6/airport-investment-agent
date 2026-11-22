/**
 * Read the FAA NASR airport CSVs (28-day subscription, APT_CSV.zip): APT_RWY.csv (one row per runway)
 * and APT_RWY_END.csv (one row per runway end, with its coordinates). Pure: takes the file text.
 */
import type { LatLon } from "./layout.ts";

/** Split one CSV line (RFC 4180 quoting: "a,b" and "" for a quote). NASR rows have no embedded newlines. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out;
}

/** Rows of a CSV with a header line, as objects keyed by column name. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0] ?? "");
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]));
  });
}

/** One NASR runway, with its two end positions when both are given. */
export interface NasrRunway {
  readonly id: string;
  readonly lengthFt: number;
  readonly surface: string;
  readonly ends: readonly [LatLon, LatLon] | null;
}

export type RunwayKind = "paved" | "unpaved";

/**
 * Which runways carry the airport's traffic, for Figure 2-1:
 * - "paved": surface code contains ASPH, CONC or PEM (the hard surfaces in NASR's code list);
 * - "unpaved": any other land surface (turf, gravel, dirt, mats...); used only at an airport with no paved
 *   runway (many Alaskan airports with scheduled service have only gravel strips);
 * - null: not a runway for this purpose: helipads (IDs starting with "H"), water lanes, rooftop and deck pads.
 */
export function runwayKind(id: string, surface: string): RunwayKind | null {
  const s = surface.toUpperCase();
  if (/^H/i.test(id.trim()) || s === "" || /WATER|ROOF|DECK/.test(s)) return null;
  return /ASPH|CONC|PEM/.test(s) ? "paved" : "unpaved";
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The NASR cycle date of the files ("YYYY/MM/DD" in EFF_DATE), as "YYYY-MM-DD"; null if absent. */
export function cycleDate(rows: readonly Record<string, string>[]): string | null {
  const d = rows[0]?.EFF_DATE?.trim();
  return d ? d.replaceAll("/", "-") : null;
}

/** Capacity runways per airport ID (NASR ARPT_ID), only for the codes asked for; landing-facility type A only. */
export function runwaysByAirport(
  rwyRows: readonly Record<string, string>[],
  endRows: readonly Record<string, string>[],
  codes: ReadonlySet<string>,
): Map<string, NasrRunway[]> {
  const ends = new Map<string, LatLon[]>();
  for (const e of endRows) {
    const code = (e.ARPT_ID ?? "").trim().toUpperCase();
    if (!codes.has(code) || e.SITE_TYPE_CODE !== "A") continue;
    const lat = num(e.LAT_DECIMAL);
    const lon = num(e.LONG_DECIMAL);
    if (lat === null || lon === null) continue;
    const key = `${code}|${(e.RWY_ID ?? "").trim()}`;
    ends.set(key, [...(ends.get(key) ?? []), { lat, lon }]);
  }
  const found = new Map<string, { paved: NasrRunway[]; unpaved: NasrRunway[] }>();
  for (const r of rwyRows) {
    const code = (r.ARPT_ID ?? "").trim().toUpperCase();
    if (!codes.has(code) || r.SITE_TYPE_CODE !== "A") continue;
    const id = (r.RWY_ID ?? "").trim();
    const surface = (r.SURFACE_TYPE_CODE ?? "").trim();
    const kind = runwayKind(id, surface);
    if (kind === null) continue;
    const located = ends.get(`${code}|${id}`);
    const runway: NasrRunway = {
      id,
      lengthFt: num(r.RWY_LEN) ?? 0,
      surface,
      ends: located !== undefined && located.length === 2 ? [located[0] as LatLon, located[1] as LatLon] : null,
    };
    const lists = found.get(code) ?? { paved: [], unpaved: [] };
    lists[kind].push(runway);
    found.set(code, lists);
  }
  const out = new Map<string, NasrRunway[]>();
  for (const [code, { paved, unpaved }] of found) {
    const list = paved.length > 0 ? paved : unpaved;
    out.set(code, [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
  }
  return out;
}
