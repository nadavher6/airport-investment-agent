/**
 * Build data/t100.json from the free BTS T-100 Segment dataset (data.bts.gov r495-tyji),
 * using server-side aggregation so the download is tiny. Per airport, for one calendar year:
 * departures (operations), passengers, seats, domestic seats -> load factor + international share.
 *
 * Run: npx tsx src/data/t100/build.ts   (writes ../../../../../data/t100.json)
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const YEAR = 2024; // latest complete calendar year in the dataset
const BASE = "https://data.bts.gov/resource/r495-tyji.json";

interface Row {
  origin_airport_code?: string;
  departures?: string;
  passengers?: string;
  seats?: string;
  domestic_seats?: string;
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

async function main(): Promise<void> {
  const params = new URLSearchParams({
    $select:
      "origin_airport_code, sum(total_departures) as departures, sum(total_passengers) as passengers, " +
      "sum(total_seats) as seats, sum(domestic_seats) as domestic_seats",
    $where: `year='${YEAR}'`,
    $group: "origin_airport_code",
    $limit: "50000",
  });
  const res = await fetch(`${BASE}?${params.toString()}`);
  if (!res.ok) throw new Error(`BTS T-100 request failed: ${res.status} ${res.statusText}`);
  const rows = (await res.json()) as Row[];

  const airports: Record<string, unknown> = {};
  for (const r of rows) {
    const code = (r.origin_airport_code ?? "").trim().toUpperCase();
    const seats = num(r.seats);
    if (code === "" || seats <= 0) continue;
    const passengers = num(r.passengers);
    const departures = num(r.departures);
    const domesticSeats = Math.min(seats, num(r.domestic_seats));
    const internationalSeats = Math.max(0, seats - domesticSeats);
    airports[code] = {
      code,
      departures,
      passengers,
      seats,
      domesticSeats,
      internationalSeats,
      loadFactor: Math.round((passengers / seats) * 1000) / 10, // percent, 1 dp
      internationalShare: Math.round((internationalSeats / seats) * 1000) / 10, // percent, 1 dp
    };
  }

  const out = {
    meta: {
      source: "BTS T-100 Segment Summary by Origin Airport (data.bts.gov r495-tyji)",
      year: YEAR,
      builtAt: new Date().toISOString().slice(0, 10),
      airportCount: Object.keys(airports).length,
    },
    airports,
  };

  const dest = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../data/t100.json");
  writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${out.meta.airportCount} airports to ${dest} (year ${YEAR}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
