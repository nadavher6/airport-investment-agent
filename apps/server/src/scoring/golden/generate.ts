/**
 * Writes scores.golden.json: every airport's absolute-mode composite score, coverage and per-KPI
 * raw value / sub-score. Generated from origin/main's scoring code (#74) so that a later change
 * that only ADDS evidence (not the score) can be proven not to move any number.
 *
 * Run it only in a checkout whose scoring code is the reference (a detached main worktree):
 *   npx tsx src/scoring/golden/generate.ts
 * Do not regenerate it to make a failing golden test pass: a changed score must be a decision.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { enplanementsDataset } from "../../data/enplanements/dataset.ts";
import { scoreAirport } from "../investmentScore.ts";

const codes = Object.keys(enplanementsDataset.airports).sort();
const airports: Record<string, unknown> = {};
for (const code of codes) {
  const record = enplanementsDataset.airports[code]!;
  const s = scoreAirport(record);
  airports[code] = {
    score: s.score,
    coverage: s.coverage,
    missing: s.missing,
    kpis: Object.fromEntries(s.kpis.map((k) => [k.key, { available: k.available, raw: k.raw, normalized: k.normalized, contribution: k.contribution }])),
  };
}

const dest = resolve(dirname(fileURLToPath(import.meta.url)), "scores.golden.json");
writeFileSync(dest, `${JSON.stringify({ airportCount: codes.length, airports }, null, 1)}\n`);
console.log(`Wrote ${codes.length} airports to ${dest}`);
