# Task 2 — Build the Local Dataset

**Objective:** Parse the 10 FAA files in `data/raw/` into a single, clean, committed
`data/enplanements.json` keyed by airport code, with a 10-year time series and derived
trend metrics.

## Input → Output

```
data/raw/faa-enplanements-cy2015.xlsx ... cy2024.xlsx   (10 workbooks)
                    │  build.ts (tsx)
                    ▼
data/enplanements.json   (one record per airport, 10-year series + derived)
```

## Output schema (`data/enplanements.json`)

```jsonc
{
  "meta": {
    "source": "FAA Passenger Boarding (Enplanement) Data",
    "years": [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    "builtAt": "2026-11-22",
    "airportCount": 512
  },
  "airports": {
    "LAX": {
      "airportCode": "LAX",
      "name": "Los Angeles International",
      "city": "Los Angeles",
      "state": "CA",
      "hubType": "L",                       // latest year's hub classification
      "series": [                           // ascending by year, nulls allowed
        { "year": 2015, "enplanements": 36351226, "rank": 3, "hubType": "L" },
        // ...
        { "year": 2024, "enplanements": 40000000, "rank": 3, "hubType": "L" }
      ],
      "latest": {
        "year": 2024,
        "enplanements": 40000000,
        "priorYear": 38000000,
        "yoyChangePct": 5.3,
        "rank": 3
      },
      "trend": {
        "cagr5yr": 2.1,                     // CY2019 -> CY2024
        "cagr10yr": 1.4,                    // CY2015 -> CY2024, null if gaps
        "recoveryVs2019": 0.98              // latest / CY2019 enplanements
      }
    }
    // ... every airport
  }
}
```

## Notes from Task 1: what the real files look like

> Found by checking every field of all 10 downloaded workbooks (2026-11-22, all passed).
> Full details: [`data/raw/SOURCES.md`](../data/raw/SOURCES.md). **Several points below
> change the build steps that follow. Where they conflict, these notes win.**

### Corrections to the steps below

1. **Step 4's "drop rows with no valid 3-letter code" won't work.** Most sheets end with an
   FAA summary block (`Large Hubs 30`, `Nonhub Primary 255`, `Total Commercial Service 511`)
   with the **count in the `Locid` column**, and `255` passes a 3-character check. Real codes
   aren't always 3 letters either (e.g. `W33`). **Rule: a row is an airport if and only if
   `S/L` is `P` or `CS`.**
2. **Step 3's "contains `enplanement` and not `prior`" can't pick the column.** Neither
   header says "prior": they're `CY 24 Enplanements` and `CY 23 Enplanements`. **Match by
   year**: current = `CY {yy} Enplanements`, where `yy` comes from the file name (`cy2024` → `24`).
3. **Compute `yoyChangePct`; don't read `% Change`.** The column is a **fraction**
   (`0.0306` = 3.06%), sometimes in scientific notation, and has one FAA error: **CY2019
   SDY** says −0.03%, but 10,055 → 10,202 is **+1.46%**.
4. **`meta.airportCount` will be 575, not "~450–550".** There are 446–522 airports per year,
   but 575 unique codes across all 10 years, and only 407 appear in every year. Update the
   acceptance range, or define the count as the latest year's (513 in CY2024).

### Field values
- **`S/L`**: `P` = primary, `CS` = non-primary commercial service.
- **`Hub`**: `L`/`M`/`S`/`N` for `P` rows. For `CS` rows it's the literal text `None`,
  or `-` in CY2020. **Normalize both to `hubType: null`.** Don't store the string "None".
- **Read only the first sheet.** CY2016 has an extra empty `Sheet1`. Some sheet names end
  in a space.
- **Key on `Locid`, never the name.** Names change between years
  (`Hartsfield - Jackson` → `Hartsfield/Jackson` in CY2023). Take `name`/`city`/`state`
  from the latest year an airport appears.

### Across years
- **Choose a rule for FAA revisions and document it.** Each file's prior-year column matches
  the previous file, except for 4 figures the FAA revised a year later:
  SFB CY2016 (1,321,675 → 1,341,699), JMS CY2016 (7,941 → 11,123),
  ALS CY2022 (10,044 → 10,047), MRI CY2023 (30,269 → 32,219).
  Suggested rule: take each year's value **from that year's own file**, and use the next
  file's prior-year column only as a cross-check in Task 4.
- **CY2020 hub categories are distorted by COVID.** The CY2020 file has a footnote saying
  some airports were "categorized differently than previous years" because of the
  pandemic. Keep per-year `hubType` in `series`, but don't treat a 2020-only hub change as
  a real reclassification. The top-level `hubType` (from 2024) is unaffected.
- **Missing years are normal.** 168 airports are absent in at least one year, and one
  airport each in CY2019 and CY2022 has no prior-year figure. Use `null`, as this doc says.
- **`cagr10yr` spans 9 periods** (2015 → 2024 is n = 9, as the formula section says), even
  though it's called "10yr". Keep n = 9, and make sure the tool output doesn't describe it
  as a 10-year rate.

### Reference values for the spot-check (from the downloaded files)

| Code | CY2015 | CY2019 | CY2020 | CY2024 (rank) | cagr10yr (n=9) | cagr5yr | recoveryVs2019 |
|---|---:|---:|---:|---|---:|---:|---:|
| ATL | 49,340,732 | 53,505,795 | 20,559,866 | 52,511,402 (#1) | 0.69% | −0.37% | 0.981 |
| LAX | 36,351,272 | 42,939,104 | 14,055,777 | 37,760,834 (#5) | 0.42% | −2.54% | 0.879 |
| ORD | 36,305,668 | 40,871,223 | 14,606,034 | 38,575,693 (#4) | 0.68% | −1.15% | 0.944 |

The schema example above is illustrative only. For instance, LAX CY2015 is 36,351,272,
not 36,351,226. Use this table as the expected output in tests.

## Build script (`src/data/enplanements/build.ts`)

Run with `tsx`. Steps:

1. **Glob** `data/raw/faa-enplanements-cy*.xlsx` (also accept `.xls`, `.csv`).
2. **Parse** each workbook with **SheetJS (`xlsx`)** → array of rows.
3. **Map columns by fuzzy header** (headers drift between years). Normalize header
   text (lowercase, strip punctuation) and match:
   - `locid` / `loc id` → `airportCode`
   - `hub` → `hubType`
   - header containing `enplanement` and not `prior` → `enplanements`
   - header containing `rank` → `rank`
   - `city`, `state`, `airport name` → identity fields
4. **Clean** values: strip commas/`$`/`%`, coerce to number; uppercase & trim codes;
   drop total/subtotal rows (no valid 3-letter code).
5. **Pivot** into per-airport records; attach each year into `series[]`.
6. **Compute derived** `latest`, `trend` (see formulas below).
7. **Write** `data/enplanements.json` (pretty-printed, stable key order).

Add an npm script:

```jsonc
// package.json (root or the owning workspace)
"scripts": {
  "data:build-enplanements": "tsx src/data/enplanements/build.ts"
}
```

Dependency: `npm i -D xlsx` (SheetJS; dev-only — the runtime uses the built JSON, not the parser).

## Derived-metric formulas

- **CAGR (n years):** `(endValue / startValue) ** (1 / n) - 1`, as a percent.
  - `cagr5yr` = CAGR from CY2019 → CY2024 (n = 5)
  - `cagr10yr` = CAGR from CY2015 → CY2024 (n = 9); `null` if either endpoint missing.
- **recoveryVs2019:** `latestEnplanements / cy2019Enplanements` (COVID recovery shape; `null` if 2019 missing).
- **yoyChangePct:** `(latest - priorYear) / priorYear * 100`.

> Guard against division by zero and missing years — many small airports have gaps.
> Prefer `null` over a fabricated number (consistency with the deterministic ethos).

## Acceptance criteria

- [ ] `npm run data:build-enplanements` produces `data/enplanements.json` with no errors
- [ ] `meta.years` has all 10 years; `meta.airportCount` is plausible (~450–550)
- [ ] Spot-check 3 large hubs (e.g. ATL, LAX, ORD) against the FAA source numbers
- [ ] CAGR/recovery values are sane (ATL ~top rank, COVID dip visible in CY2020)
- [ ] JSON is committed; `data/raw/` stays gitignored

## Design notes / tradeoffs

- **JSON over SQLite:** 10 yrs × ~500 airports ≈ 5k airport records; the whole file is
  a few MB and loads into memory instantly. No native deps, trivially committable and
  diffable. Revisit SQLite only if the dataset grows (e.g. adding monthly T-100 data).
- **Latest hubType at top level** for convenient filtering; per-year hubType kept in
  `series` since classification can change year to year.
- Keep `build.ts` idempotent and pure (no network) — it only reads `data/raw/`.
