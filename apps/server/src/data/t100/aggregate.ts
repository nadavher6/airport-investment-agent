// Pure part of the T-100 build: turn the BTS per-airport rows into data/t100.json's `airports`.
// No network here, so it is unit-tested with fixture rows (aggregate.test.ts).
import type { T100Airport } from "./types.ts";

/** One row of the BTS Socrata response (r495-tyji grouped by origin airport); numbers arrive as strings. */
export interface T100Row {
  readonly origin_airport_code?: string;
  readonly departures?: string;
  readonly passengers?: string;
  readonly seats?: string;
  readonly domestic_seats?: string;
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Plain code-point order, so the result does not depend on the machine's locale. */
const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Per-airport T-100 stats, keyed and ordered by airport code (ascending), so two builds from the
 * same rows write byte-identical JSON whatever order BTS returns the rows in. Rows whose code
 * differs only by case or spaces are summed. Airports with no seats are dropped.
 */
export function aggregateT100(rows: readonly T100Row[]): Record<string, T100Airport> {
  const totals = new Map<string, { departures: number; passengers: number; seats: number; domesticSeats: number }>();
  for (const r of rows) {
    const code = (r.origin_airport_code ?? "").trim().toUpperCase();
    if (code === "") continue;
    const t = totals.get(code) ?? { departures: 0, passengers: 0, seats: 0, domesticSeats: 0 };
    t.departures += num(r.departures);
    t.passengers += num(r.passengers);
    t.seats += num(r.seats);
    t.domesticSeats += num(r.domestic_seats);
    totals.set(code, t);
  }

  const airports: Record<string, T100Airport> = {};
  for (const [code, t] of [...totals.entries()].sort(([a], [b]) => byCode(a, b))) {
    if (t.seats <= 0) continue;
    const domesticSeats = Math.min(t.seats, t.domesticSeats);
    const internationalSeats = Math.max(0, t.seats - domesticSeats);
    airports[code] = {
      code,
      departures: t.departures,
      passengers: t.passengers,
      seats: t.seats,
      domesticSeats,
      internationalSeats,
      loadFactor: Math.round((t.passengers / t.seats) * 1000) / 10, // percent, 1 dp
      internationalShare: Math.round((internationalSeats / t.seats) * 1000) / 10, // percent, 1 dp
    };
  }
  return airports;
}
