# FAA enplanement source files: provenance

The workbooks themselves are gitignored. This file records where each one came from, so the dataset can be
reproduced and checked. Re-download with `npm run data:download` (`-- --force` to replace existing files).
The script holds the same SHA-256 values and rejects any file that doesn't match, so if the FAA republishes a
file, update the script and this table together.

- **Publisher:** Federal Aviation Administration, Office of Airports
- **Dataset:** Passenger Boarding (Enplanement) Data, *Commercial Service Enplanements*, final calendar-year files
- **Index pages:**
  - Current year: https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger
  - Previous years: https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger/previous_years
- **Downloaded:** 2026-11-22, via `curl` with a browser User-Agent (the FAA returns 403 to other clients)

| Year | File | Source URL | Bytes | SHA-256 | Airport rows |
|---|---|---|---:|---|---:|
| 2015 | `faa-enplanements-cy2015.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy15-commercial-service-enplanements.xlsx | 59918 | `429d20c8189d430439ac5f77518128041ba8c3fbbf80b309d1367b92736d2715` | 503 |
| 2016 | `faa-enplanements-cy2016.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy16-commercial-service-enplanements.xlsx | 58816 | `3ab9366c521013d82ad9a155c6b5321e350a4166c3eb6387668ba5407e443222` | 506 |
| 2017 | `faa-enplanements-cy2017.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy17-commercial-service-enplanements.xlsx | 58348 | `ab4d69b900371256985f58eb744ccb4a8976d624db5b12a9dfc26fa9a9f89df5` | 511 |
| 2018 | `faa-enplanements-cy2018.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy18-commercial-service-enplanements.xlsx | 58016 | `88a53435e846b4fcb4a602c94c6b5b4a240c7e1cf74b991733604d175510b47b` | 519 |
| 2019 | `faa-enplanements-cy2019.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy19-commercial-service-enplanements.xlsx | 64611 | `84924e4a4500e3e1e2fc74b5720c92ad50302618f7357f46fcfe07eefc099bce` | 522 |
| 2020 | `faa-enplanements-cy2020.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy20-commercial-service-enplanements.xlsx | 53222 | `91b00a4643a35a27bd975c14ef111066838ace9b36c2d034c49c5920e964ab10` | 446 |
| 2021 | `faa-enplanements-cy2021.xlsx` | https://www.faa.gov/sites/faa.gov/files/2022-09/cy21-commercial-service-enplanements.xlsx | 57140 | `41dcbb24d5209662803f4182cb27a6cc60086ad70b5bb24d619a48b08bca551b` | 478 |
| 2022 | `faa-enplanements-cy2022.xlsx` | https://www.faa.gov/sites/faa.gov/files/2023-09/cy22-commercial-service-enplanements.xlsx | 57395 | `629652c78756edc22b56a4cf7eaeed09988d8d10c81aa5dbd1c0faa0f424cef7` | 506 |
| 2023 | `faa-enplanements-cy2023.xlsx` | https://www.faa.gov/sites/faa.gov/files/2024-10/cy23-commercial-service-enplanements.xlsx | 56743 | `653fe78e925fe85d0155fd8f5230a57bc437786cd7ed44bcd7a34d942ed2cdd1` | 502 |
| 2024 | `faa-enplanements-cy2024.xlsx` | https://www.faa.gov/sites/faa.gov/files/2026-09/arp-cy2024-commercial-service-enplanements.xlsx | 58202 | `bbba0541110c790021967d52591d60c8af852b8350831c9c26cfb91be7b3e13c` | 513 |

Check local copies with:

```bash
cd data/raw && shasum -a 256 faa-enplanements-cy*.xlsx
```

"Airport rows" counts only real airport rows. The FAA's summary block at the bottom of most sheets is excluded.

## Format notes (for Task 2: build the dataset)

Every workbook was checked field by field after a clean `npm run data:download`. All 10 pass.

**Structure**
- **All 10 are `.xlsx`** (valid zip with a workbook part). No `.xls` or PDF-only years, so no conversion is needed.
- **The header row is identical across all 10 years**, on row 1:
  `Rank, RO, ST, Locid, City, Airport Name, S/L, Hub, CY YY Enplanements, CY YY-1 Enplanements, % Change`.
  The enplanement headers carry the 2-digit year (`CY 24 Enplanements`), so match them by pattern, not by exact text.
- **Read the first sheet.** CY2016 has an extra empty `Sheet1`. Some sheet names have a trailing space.

**Which rows are airports**
- **An airport row is one whose `S/L` is `P` or `CS`.** Below the table, most years have a **summary block** (e.g.
  `Large Hubs 30`, `Nonhub Primary 255`, `Total Commercial Service 511`) whose numbers sit in the `Locid` column. They
  look like codes but are not airports. The per-hub counts computed from airport rows match every one of these totals.
- **CY2020 also has a footnote row** in the `Rank` column: hub categories that year were based on COVID-depressed
  traffic, so *some airports are categorized differently than previous years*. Don't read CY2020 hub changes as real
  structural changes.

**Field values**
- **`S/L`**: `P` = primary, `CS` = non-primary commercial service.
- **`Hub`** depends on `S/L`:
  - for `P` airports it is `L` / `M` / `S` / `N` (large / medium / small / nonhub);
  - for `CS` airports it is the literal text `None`, or `-` in CY2020. Normalize both to "no hub".
- **`% Change` is a fraction, not a percent**: `0.0306` means +3.06%. Some cells are in scientific notation (`5.87E-2`).
- **Compute % change yourself; don't trust the column.** It matches `(current − prior) / prior` for every airport
  except one FAA error: **CY2019 SDY** says −0.03%, but its own figures (10,055 → 10,202) give +1.46%.
- Enplanements are whole numbers. One airport in CY2019 and one in CY2022 have no prior-year figure or `% Change`
  (likely new service), so there is no trend for them in that year.
- **Airport names drift between years** (e.g. `Hartsfield - Jackson Atlanta International` →
  `Hartsfield/Jackson Atlanta International` in CY2023). Key on `Locid`, not on the name.

**Across years**
- **Years chain:** each file's prior-year column matches the previous file's current-year column for all airports in
  both (e.g. ATL CY23 = 50,950,068 in both files). There are 4 exceptions, where the FAA **revised** a figure in the
  following year's file:

  | Airport | Year revised | Original file | Next year's file |
  |---|---|---:|---:|
  | SFB | CY2016 | 1,321,675 | 1,341,699 |
  | JMS | CY2016 | 7,941 | 11,123 |
  | ALS | CY2022 | 10,044 | 10,047 |
  | MRI | CY2023 | 30,269 | 32,219 |

  Pick one rule and document it. The simplest is to take each year's value from that year's own file.
- **CY2025 exists** on the FAA's current-year page (`arp-cy2025-commercial-service-enplanements.xlsx`). It's left out
  here because the task scope is CY2015–CY2024.

## The built dataset: `data/enplanements.json`

`npm run data:build-enplanements` (code in `apps/server/src/data/enplanements/`) reads the first sheet of every
`data/raw/faa-enplanements-cy*.xlsx` and writes `data/enplanements.json`, which is committed. It needs no network,
and two runs give byte-identical output apart from `meta.builtAt`. Server code reads the data through
`apps/server/src/data/enplanements/dataset.ts`.

**Parsing rules**
- A row is an airport if and only if its `S/L` is `P` or `CS`. Airports are keyed on `Locid` (codes such as `W33`
  are not always 3 letters); `name`, `city` and `state` come from the latest year the airport appears.
- The current-year column is `CY {yy} Enplanements`, with `yy` from the file name; the prior-year column is
  `CY {yy-1} Enplanements`. Other columns are matched by normalized header name, not position.
- `Hub` is `L`/`M`/`S`/`N` for primary airports; `None` and `-` become `null`.
- The FAA `% Change` column is never read. `latest.yoyChangePct` = `(latest − prior) / prior × 100`, using the
  prior-year figure in the latest year's own file.

**Revision rule.** Each year's value comes from that year's own file. The next file's prior-year column is used
only as a cross-check (the build prints the differences). It finds exactly the four known FAA revisions listed
above (SFB 2016, JMS 2016, ALS 2022, MRI 2023); the dataset keeps the original figure for each.

**COVID note.** CY2020 hub categories are based on COVID-depressed traffic, so some airports have a different
`hubType` that year. Each `series` point keeps its own year's `hubType`; the airport's top-level `hubType` is the
latest year's. Don't read a CY2020 hub change as a structural change.

**Trend fields** (percent unless noted; `null` when an endpoint is missing, never estimated)
- `cagr5yr`: CAGR from CY2019 to CY2024, 5 periods: `((2024 / 2019)^(1/5) − 1) × 100`.
- `cagr10yr`: CAGR from CY2015 to CY2024. The name says 10 years (10 data years), but that is **9 periods**:
  `((2024 / 2015)^(1/9) − 1) × 100`.
- `recoveryVs2019`: latest-year enplanements / CY2019 enplanements, as a ratio (1 = back to 2019 level).
- Rates are rounded to 4 decimals. Missing years are omitted from `series`; a missing prior-year figure gives
  `priorYear: null` and `yoyChangePct: null`.

`meta.airportCount` counts unique codes across all ten years (575); CY2024 alone has 513.

## Known `npm audit` finding: `xlsx@0.18.5`

The build reads the FAA workbooks with SheetJS (`xlsx`, `apps/server/src/data/enplanements/workbook.ts`). `npm audit`
reports one high-severity finding for it, with no fix available on the npm registry:

| Advisory | Issue | Affected range (from `npm audit`) |
|---|---|---|
| GHSA-4r6h-8v6p-xvw6 (CVE-2023-30533) | Prototype pollution when reading a crafted file | `< 0.19.3` |
| GHSA-5pgg-2g8v-p4x9 (CVE-2024-22363) | Regular expression denial of service (ReDoS) | `< 0.20.2` |

**Why it is acceptable here**
- `xlsx` is a `devDependency` of `apps/server`, pinned exactly to `0.18.5`. `npm audit --omit=dev` (the production
  dependencies) reports `found 0 vulnerabilities`.
- Only build code imports it: `workbook.ts`, which `build.ts` and the tests use. `dataset.ts`, the runtime entry point,
  imports only the committed `data/enplanements.json`, so the running server never loads `xlsx`.
- It only parses the 10 FAA files, and those are not arbitrary input: `npm run data:download` rejects any file whose
  SHA-256 differs from the values in the table above, so a crafted workbook can't reach the parser through that script.
  Both flaws need a malicious file.

**Why the SheetJS CDN build was not used.** SheetJS publishes the fixed versions (0.19.3 and later, 0.20.x) only on
its own CDN, not on npm; the latest `xlsx` on npm is 0.18.5. A tarball from the CDN would avoid the finding, but it
takes the dependency off the npm registry, and the review asked for the version to be pinned there. The risk above is
low, so the pinned registry version was kept. If a clean `npm audit` is wanted later, switch to the CDN tarball
(0.20.x) or to another parser; the build only uses `XLSX.read` and `sheet_to_json`.
