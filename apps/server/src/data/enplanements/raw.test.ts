// Checks against the raw FAA workbooks. Skipped when data/raw has none (e.g. in CI); run
// `npm run data:download` first to include it.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assembleDataset, findRevisions, serializeDataset, yoyChangePct } from "./assemble.ts";
import { DEFAULT_OUT_FILE, DEFAULT_RAW_DIR, readYearTables } from "./build.ts";
import type { YearTable } from "./types.ts";

const hasRaw = existsSync(DEFAULT_RAW_DIR) && readdirSync(DEFAULT_RAW_DIR).some((f) => /^faa-enplanements-cy\d{4}\.xlsx$/.test(f));

describe.skipIf(!hasRaw)("raw FAA workbooks", () => {
  const tables: YearTable[] = hasRaw ? readYearTables(DEFAULT_RAW_DIR) : [];

  it("has the airport row counts recorded in data/raw/SOURCES.md", () => {
    expect(tables.map((t) => [t.year, t.rows.length])).toEqual([
      [2015, 503], [2016, 506], [2017, 511], [2018, 519], [2019, 522],
      [2020, 446], [2021, 478], [2022, 506], [2023, 502], [2024, 513],
    ]);
  });

  it("rebuilds the committed JSON byte for byte, apart from builtAt", () => {
    const committed = readFileSync(DEFAULT_OUT_FILE, "utf8");
    const builtAt = /"builtAt": "(\d{4}-\d{2}-\d{2})"/.exec(committed)?.[1] ?? "";
    expect(serializeDataset(assembleDataset(tables, builtAt))).toBe(committed);
  });

  it("each year's yoyChangePct matches that file's own prior-year figures", () => {
    for (const table of tables) {
      for (const row of table.rows) {
        const prior = row.priorYearEnplanements;
        const expected = prior ? ((row.enplanements - prior) / prior) * 100 : null;
        const actual = yoyChangePct(row.enplanements, prior);
        if (expected === null) expect(actual).toBeNull();
        else expect(actual).toBeCloseTo(expected, 3);
      }
    }
  });

  it("CY2019 SDY YoY is +1.46% from its own file", () => {
    const sdy = tables.find((t) => t.year === 2019)?.rows.find((r) => r.airportCode === "SDY");
    expect(sdy).toMatchObject({ enplanements: 10202, priorYearEnplanements: 10055 });
    expect(yoyChangePct(sdy?.enplanements ?? null, sdy?.priorYearEnplanements ?? null)).toBeCloseTo(1.46, 2);
  });

  it("finds exactly the four known FAA revisions, and the dataset keeps each year's own value", () => {
    const revisions = findRevisions(tables);
    expect(revisions).toEqual([
      { airportCode: "SFB", year: 2016, original: 1321675, revised: 1341699 },
      { airportCode: "JMS", year: 2016, original: 7941, revised: 11123 },
      { airportCode: "ALS", year: 2022, original: 10044, revised: 10047 },
      { airportCode: "MRI", year: 2023, original: 30269, revised: 32219 },
    ]);
    const dataset = assembleDataset(tables, "2026-01-01");
    for (const r of revisions) {
      const point = dataset.airports[r.airportCode]?.series.find((p) => p.year === r.year);
      expect(point?.enplanements).toBe(r.original);
    }
  });
});
