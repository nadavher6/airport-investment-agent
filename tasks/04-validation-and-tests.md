# Task 4 — Validation & Tests

**Objective:** Prove the dataset is correct and the tool behaves, with automated tests
(Vitest, per the repo's testing convention) plus manual spot checks.

## 4a. Data spot checks (manual, one-time)

Verify the built `data/enplanements.json` against the FAA source for a few anchors:

| Airport | Expectation |
|---|---|
| **ATL** | #1 rank most years; Large hub; highest enplanements |
| **LAX / ORD / DFW / DEN** | top-10 Large hubs |
| **Any airport** | CY2020 enplanements show the **COVID dip** (sharp drop vs. CY2019) |
| **A small hub** | `hubType` = `S` or `N`; smaller totals; possible year gaps → `null` CAGR |

Confirm 2–3 exact numbers against the FAA workbook so you trust the parser.

## 4b. Automated tests (`src/data/enplanements/lookup.test.ts`)

Cover with Vitest (files sit next to the code, `*.test.ts`):

```ts
import { describe, it, expect } from "vitest";
import { getEnplanements } from "./lookup";

describe("getEnplanements", () => {
  it("returns a record for a known large hub", () => {
    const r = getEnplanements("LAX");
    expect(r).not.toBeNull();
    expect(r!.hubType).toBe("L");
    expect(r!.latest.enplanements).toBeGreaterThan(10_000_000);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(getEnplanements("  lax ")).toEqual(getEnplanements("LAX"));
  });

  it("returns null for an unknown code (never fabricates)", () => {
    expect(getEnplanements("ZZZ")).toBeNull();
  });

  it("exposes a 10-year series in ascending year order", () => {
    const r = getEnplanements("ATL")!;
    const years = r.series.map((s) => s.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    expect(years.length).toBeLessThanOrEqual(10);
  });

  it("computes sane trend metrics", () => {
    const r = getEnplanements("ATL")!;
    if (r.trend.cagr5yr !== null) {
      expect(r.trend.cagr5yr).toBeGreaterThan(-50);
      expect(r.trend.cagr5yr).toBeLessThan(50);
    }
  });
});
```

### Dataset invariants test (guards against a bad rebuild)

```ts
import data from "../../../data/enplanements.json";

it("dataset meta covers 10 years and a plausible airport count", () => {
  expect(data.meta.years).toHaveLength(10);
  expect(data.meta.airportCount).toBeGreaterThan(300);
});

it("every airport record has a code and a non-empty series", () => {
  for (const [code, rec] of Object.entries<any>(data.airports)) {
    expect(code).toMatch(/^[A-Z0-9]{3,4}$/);
    expect(rec.series.length).toBeGreaterThan(0);
  }
});
```

## 4c. Tool-level test

- Call the registered tool with `{ airport_code: "LAX" }` → real record.
- Call with `{ airport_code: "ZZZ" }` → `{ error: "no_enplanement_data" }`.
- (If wired to scoring) a known Large hub with positive CAGR scores higher on the
  growth KPI than a declining one.

## 4d. Agent smoke test

Ask the running agent:

> "How has LAX passenger traffic trended over the last 10 years, and is it above or
> below its 2019 peak?"

Expect a brief that cites a **real CY2024 enplanement figure**, the **CAGR**, and the
**recovery-vs-2019** ratio — not a mocked/round number.

## Acceptance criteria

- [ ] `npm test` passes (lookup + dataset-invariant + tool tests)
- [ ] Manual spot checks match FAA source numbers
- [ ] Agent smoke test returns real, cited figures
- [ ] `DESIGN.md` §4 updated: note enplanements are now **real FAA data (CY2015–CY2024)**,
      and remove the "mocked throughput" limitation for this metric

## Regression / maintenance

- When FAA posts a new year: drop the file in `data/raw/`, rerun
  `npm run data:build-enplanements`, bump `meta.years`, rerun tests. The invariant
  test (10-year length) must be updated to the new window.
