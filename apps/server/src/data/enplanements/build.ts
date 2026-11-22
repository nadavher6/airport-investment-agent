// Builds data/enplanements.json from data/raw/faa-enplanements-cy*.xlsx.
// Run with `npm run data:build-enplanements` (after `npm run data:download`). No network.
// Usage: tsx build.ts [--raw <dir>] [--out <file>]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleDataset, findRevisions, serializeDataset } from "./assemble.ts";
import { parseYearSheet, yearFromFileName } from "./parse.ts";
import type { YearTable } from "./types.ts";
import { readFirstSheet } from "./workbook.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
export const DEFAULT_RAW_DIR = join(REPO_ROOT, "data", "raw");
export const DEFAULT_OUT_FILE = join(REPO_ROOT, "data", "enplanements.json");

const RAW_FILE = /^faa-enplanements-cy\d{4}\.xlsx$/;

/** Reads and parses every `faa-enplanements-cyYYYY.xlsx` in rawDir, ascending by year. */
export function readYearTables(rawDir: string): YearTable[] {
  const files = readdirSync(rawDir).filter((name) => RAW_FILE.test(name)).sort();
  if (files.length === 0) {
    throw new Error(`no faa-enplanements-cy*.xlsx files in ${rawDir}; run \`npm run data:download\` first`);
  }
  return files.map((file) => parseYearSheet(readFirstSheet(readFileSync(join(rawDir, file))), yearFromFileName(file)));
}

function argValue(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(args: readonly string[]): void {
  const rawDir = resolve(argValue(args, "--raw") ?? DEFAULT_RAW_DIR);
  const outFile = resolve(argValue(args, "--out") ?? DEFAULT_OUT_FILE);

  const tables = readYearTables(rawDir);
  const builtAt = new Date().toISOString().slice(0, 10);
  const dataset = assembleDataset(tables, builtAt);
  writeFileSync(outFile, serializeDataset(dataset));

  for (const table of tables) console.log(`CY${table.year}: ${table.rows.length} airports`);
  console.log(`${dataset.meta.airportCount} unique airports -> ${outFile}`);
  // Each year's value comes from its own file; the next file's prior-year column is only a cross-check.
  for (const r of findRevisions(tables)) {
    console.log(`revision (kept original): ${r.airportCode} CY${r.year} ${r.original} -> ${r.revised} in CY${r.year + 1} file`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
