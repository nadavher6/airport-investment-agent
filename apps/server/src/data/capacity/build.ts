// Builds data/capacity.json from the FAA NASR runway CSVs (downloaded by scripts/download-faa-nasr.sh).
// Run with `npm run data:build-capacity` (downloads, checks the SHA-256, then builds). No network here.
// Usage: tsx build.ts [--rwy <APT_RWY.csv>] [--ends <APT_RWY_END.csv>] [--codes <enplanements.json>] [--out <file>]
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleCapacity, serializeCapacity } from "./assemble.ts";
import { cycleDate, parseCsv, runwaysByAirport } from "./nasr.ts";
import type { CapacityDataset } from "./types.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
export const DEFAULT_PATHS = {
  rwy: join(REPO_ROOT, "data", "raw", "nasr", "APT_RWY.csv"),
  ends: join(REPO_ROOT, "data", "raw", "nasr", "APT_RWY_END.csv"),
  codes: join(REPO_ROOT, "data", "enplanements.json"),
  out: join(REPO_ROOT, "data", "capacity.json"),
} as const;

export interface BuildPaths {
  readonly rwy: string;
  readonly ends: string;
  /** A JSON file with an `airports` object keyed by airport code (data/enplanements.json): the airports to cover. */
  readonly codes: string;
  readonly out: string;
}

/** Read the inputs, build the dataset and write it. Returns the dataset (for the report and the tests). */
export function buildCapacity(paths: BuildPaths): CapacityDataset {
  const rwyRows = parseCsv(readFileSync(paths.rwy, "utf8"));
  const endRows = parseCsv(readFileSync(paths.ends, "utf8"));
  const codes = Object.keys((JSON.parse(readFileSync(paths.codes, "utf8")) as { airports: Record<string, unknown> }).airports);
  const cycle = cycleDate(rwyRows);
  if (cycle === null) throw new Error(`${paths.rwy} has no EFF_DATE: not a NASR APT_RWY.csv`);
  const dataset = assembleCapacity(codes, runwaysByAirport(rwyRows, endRows, new Set(codes)), cycle);
  writeFileSync(paths.out, serializeCapacity(dataset));
  return dataset;
}

function argValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(args: readonly string[]): void {
  const pick = (flag: string, fallback: string): string => resolve(argValue(args, flag) ?? fallback);
  const paths: BuildPaths = {
    rwy: pick("--rwy", DEFAULT_PATHS.rwy),
    ends: pick("--ends", DEFAULT_PATHS.ends),
    codes: pick("--codes", DEFAULT_PATHS.codes),
    out: pick("--out", DEFAULT_PATHS.out),
  };
  const { meta, airports } = buildCapacity(paths);
  const counts = new Map<string, number>();
  for (const a of Object.values(airports)) {
    const key = a.configuration ? `config ${a.configuration.figure21No}` : `missing: ${a.missingReason ?? "?"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  console.log(`Wrote ${meta.airportCount} airports (${meta.mappedCount} mapped, NASR cycle ${meta.nasrCycle}) to ${paths.out}`);
  for (const [key, n] of [...counts.entries()].sort()) console.log(`  ${key}: ${n}`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
