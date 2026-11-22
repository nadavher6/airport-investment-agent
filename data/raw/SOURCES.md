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

## Place data: `metros.json` and `regions.json`

These two files are **hand-curated**, committed, and need no network or key. They only group airport codes
by place. Every number about an airport (name, city, hub size, enplanements) still comes from the FAA data
in `data/enplanements.json` (provenance: the sections above).

### `data/metros.json`

`{ "metros": { "<Metro name>": { "aliases": [...], "airports": [ { "code": "JFK", "secondary": false } ] } } }`

- **Curated by judgment, not an official list.** A metro is the airports a traveller would treat as "the
  airports of that city" (for example New York: JFK, LGA, EWR plus HPN and ISP). Grouping follows common
  metropolitan-area usage (US Census metropolitan / combined statistical areas were the reference), not a
  formal table.
- **Coverage:** the metro of every Large and Medium hub in the FAA CY2024 data (63 airports), plus a set of
  Small hubs that the regions below need (for example Spokane, Burlington VT, El Paso). Aliases cover
  common names such as "NYC", "Bay Area", "DC", "Twin Cities".
- **Codes are checked against data.** `places.integrity.test.ts` fails if a code is not in
  `data/enplanements.json`.
- **`secondary`** means a smaller airport serving the metro alongside its main one(s). Rule used:
  an airport is `secondary: true` when its CY2024 enplanements are **under 20% of the largest airport in
  that metro**. For example LAX 37.8M: SNA 5.4M, ONT, BUR and LGB are secondary; New York JFK 31.5M: HPN
  and ISP are secondary, LGA and EWR are not. The test re-computes this rule from the real data, so a flag
  cannot drift from it. The 20% line is a judgment; OAK (21% of SFO) and SJC (23%) and DAL (20.4% of DFW)
  land just above it and count as main airports.
- A metro with one airport has no secondary. An airport may appear in more than one metro (BWI is in both
  Washington DC and Baltimore; PVD and MHT are secondary in Boston and main in Providence and Manchester).
- A name or alias belongs to one metro only (the test checks that the normalized text is unique).

### `data/regions.json`

`{ "regions": { "<Region name>": { "aliases": [...], "cities": ["<Metro name>", ...] } } }`

- **Curated and informal.** Regions such as "West Coast" or "Gulf Coast" have no official definition, so
  each list is a judgment of which metros people mean. Where an official frame exists it was the reference:
  the **US Census Bureau regions and divisions** for Midwest (Census Midwest region), New England (Census
  division) and Mountain West (Census Mountain division, trimmed to the metros in the data); East Coast,
  West Coast, Pacific Northwest, Southwest, Southeast and Gulf Coast are informal and follow the Census
  states they sit in.
- Every city listed must be a metro name in `metros.json` (checked by the integrity test).
- States are not covered; the owner did not ask for them.
- A region lists metros, not airports: the airports come from the metro list at query time.

## BTS T-100: `data/t100.json`

Congestion, unmet demand (load factor) and long-haul share come from the **BTS T-100 Segment** data, not from
the FAA files above.

- **Publisher:** US Bureau of Transportation Statistics (BTS), on its Socrata open-data portal.
- **Dataset:** T-100 Segment Summary by Origin Airport, dataset ID `r495-tyji`.
- **Source URL (API):** https://data.bts.gov/resource/r495-tyji.json (dataset page: https://data.bts.gov/d/r495-tyji).
- **Keyless:** the build uses plain `fetch` with no app token, no `X-App-Token` header and no `.env` value.
  Socrata throttles anonymous clients, so a rebuild can fail with HTTP 429; it does not return different data.
- **Build-only network:** `npm run data:build-t100` (`apps/server/src/data/t100/build.ts`) is the only code that
  calls BTS. The server and the tests read the committed `data/t100.json` (`apps/server/src/data/t100/dataset.ts`),
  so nothing at runtime or in `npm test` touches the network.
- **Query:** one server-side aggregated request, grouped by `origin_airport_code`, summing `total_departures`,
  `total_passengers`, `total_seats` and `domestic_seats` over the window. Per airport: `loadFactor` =
  passengers ÷ seats and `internationalShare` = (seats − domestic seats) ÷ seats, both in percent with 1 decimal;
  airports with no seats are dropped.
- **Window: the trailing 12 months** ending at the newest `reporting_month` BTS has when the build runs (not a
  calendar year). The committed file covers **2025-09 to 2026-08** (`meta.periodStart`/`meta.periodEnd`), built
  2026-11-22, **1,312 airports**. A rebuild later moves the window and changes the scores.
- **Deterministic output:** airports are written in airport-code order (`aggregate.ts`), so two builds of the same
  window give byte-identical files apart from `meta.builtAt`.
- **Window mismatch with the FAA data:** FAA enplanements are **calendar years** (growth uses CY2019→CY2024); T-100
  is the **trailing 12 months** above. The sources also count differently (enplanements vs segment passengers), so
  one airport's T-100 passengers can differ from its FAA enplanements by around 10% (ORD +10%, ATL −3%).
- **Known quirk, accepted:** a tiny airport can have a load factor above 100% (more passengers than seats). In the
  committed file only **ODW** does: **108.3% from 2 departures**. It is kept as reported, not capped; see DESIGN.md §4.

## FAA NASR runways and AC 150/5060-5: `data/capacity.json` (#54)

Runway capacity for the congestion KPI (runway utilization = operations ÷ ASV). Method and assumptions: DESIGN.md §1
"Runway capacity (ASV)" and §4.

**Runway data: FAA NASR (National Airspace System Resources), 28-day subscription**
- **Publisher:** FAA Aeronautical Information Services (the 5010 airport master records, published through NASR).
- **Index page:** https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/2026-10-29
  (cycle effective **2026-10-29**, the current cycle on the day it was downloaded).
- **File:** https://nfdc.faa.gov/webContent/28DaySub/extra/29_Oct_2026_APT_CSV.zip, 8,502,128 bytes,
  SHA-256 `6e1e422f483d44cc8a38a1c97cf98e97588a6fc3fa857b39b5bdcbcfe8331154`. Downloaded **2026-11-22** with `curl`
  (browser User-Agent). Free and public: no key, no login.
- **Used from the zip:** `APT_RWY.csv` (one row per runway) and `APT_RWY_END.csv` (one row per runway end). Both are
  gitignored under `data/raw/nasr/`; only the built `data/capacity.json` is committed.
- **Fields read:** `EFF_DATE` (cycle), `SITE_TYPE_CODE` (only `A` = airport; heliports and seaplane bases are other
  codes), `ARPT_ID` (FAA location ID, the same key as `data/enplanements.json`), `RWY_ID`, `RWY_LEN`,
  `SURFACE_TYPE_CODE`, and per end `LAT_DECIMAL` / `LONG_DECIMAL`.
- **Rebuild:** `npm run data:build-capacity` runs `scripts/download-faa-nasr.sh` (download into a new temporary
  directory, SHA-256 check, extract the two CSVs into `data/raw/nasr/`), then `apps/server/src/data/capacity/build.ts`.
  The build itself needs no network; the server and the tests read only the committed JSON
  (`apps/server/src/data/capacity/dataset.ts`). A newer NASR cycle has a new URL and checksum: update the script and
  this section together.
- **Deterministic:** airports are written in code order and the file has no build date (`meta.nasrCycle` dates it),
  so two builds from the same files are byte-identical (checked: SHA-256
  `fc189a0ca5275ffea7dd7cadaca5fcc66badce9e81dc5ed860c88ae693c2340a` both times).
- **Coverage:** the 575 airports of `data/enplanements.json`. 569 map to a configuration. 6 have no land runway in
  NASR and are `configuration: null` with a `missingReason`: **ISN** (Sloulin Field, closed; replaced by XWA),
  **PBI** (renamed: NASR lists Palm Beach International as **DJT**, and T-100 also reports it as DJT, so every T-100
  KPI is already missing for PBI), **W33**, **CGA**, **KAE**, **MTM** (seaplane bases).

**Which runways count** (`runwayKind` in `nasr.ts`): paved runways (surface contains `ASPH`, `CONC` or `PEM`); at an
airport with no paved runway, its unpaved land runways (turf, gravel, dirt; many Alaskan airports with scheduled
service). Helipads (`H…` IDs), water lanes and rooftop/deck pads never count.

**Parallel test.** Two runways are parallel when their headings (from the end coordinates) differ by at most 10°.
Over every runway pair at the 575 airports, the differences are under 1° (210 pairs), then 2.0° (ORD), 2.1° (MAF),
2.2° (CNM), 3.8° (DFW), 5.0° (SLC, 17/35 against 16L/16R), 9.5° (BOS, 14/32 against 15R/33L), and the next is 17°.
So any cut-off between 9.5° and 17° gives the same groups.

**ASV table: FAA Advisory Circular AC 150/5060-5, *Airport Capacity and Delay*, Change 2 (1995-12-01)**
- **URL:** https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5060_5.pdf, 12,753,978 bytes,
  SHA-256 `fb0583932d2a7366ef195ad5707fa1edd27c0b7362a2cdc2e166537bf235fc72`, downloaded 2026-11-22. Not committed.
- **Used:** Chapter 2, paragraphs 2-2 (assumptions; 2-2.f: 3,400 ft independent spacing needs PRM radar, else
  4,300 ft), 2-3.b (the airport runs its highest-capacity configuration ~80% of the time), 2-4 (how to read the
  figure), and **Figure 2-1 "Capacity and ASV for long range planning"** (AC pages 8–11): the ASV column for the 19
  runway-use configurations and five mix-index bands. The values were read from the scanned figure and typed into
  `FIGURE_2_1_ASV` (`apps/server/src/data/capacity/asv.ts`); `asv.test.ts` pins three rows.
- **ASV used:** the midpoint of each row's lowest and highest value, because the mix index needs fleet-mix data that
  is not freely tabulated.
- **Also used for the Core 30 annualization (below):** paragraph 2-3.a (IFR weather roughly 10% of the time),
  **Table 2-1** (demand ratios D and H by mix index: 81–120 → D 320, H 12; 121–180 → D 350, H 14; read from the PDF's
  text layer, p. 5) and paragraph **3-6** (ASV = Cw × D × H). Same file and checksum as above.
- **Extension (not an FAA figure):** for parallel layouts Figure 2-1 does not draw, increments read off the same
  figure (configuration 8 − 2 = 307,500 per extra independent pair; configuration 4 − 1 = 120,000 per extra
  independent runway). Rule and reasoning: DESIGN.md §1 "Runway capacity (ASV)" (c).

**Core 30 capacity: FAA *Airport Capacity Profiles* (2014)**
- **Publisher:** FAA Office of Airports (Airport Planning and Programming, APP-400), prepared by MITRE CAASD; report
  date May 2014 (cover July 2014). Index page: https://www.faa.gov/airports/planning_capacity/profiles
- **URL:** https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/profiles/Airport-Capacity-Profiles-2014.pdf,
  11,089,544 bytes, SHA-256 `246e026b9532a09542a174478e115d7578a9e7f57412efbf57b88c9e615f6cdb`, downloaded
  **2026-11-22** with `curl` into a fresh empty directory. Free and public: no key, no login. **Not committed.**
- **Used:** **Table 1 "Capacity Rate Ranges for Current Operations at the Core Airports"** (report p. 9, PDF p. 12):
  aircraft operations (arrivals + departures) per hour in visual, marginal and instrument weather for the 30 Core
  airports, each a range from the ATC Facility Reported ("called") rate to the model-estimated rate; some cells give
  arrival-priority and departure-priority configurations. Transcribed cell by cell into
  `CORE30_CAPACITY_PROFILES_2014` (`apps/server/src/data/capacity/profiles.ts`, which cites the table); the cells were
  matched to their columns by their x/y positions in the PDF's text layer; `profiles.test.ts` pins four rows.
- **Derived and committed:** only the per-airport ASV (`capacity` in `data/capacity.json`, source
  `faa-capacity-profile`), computed at build time as (90% visual + 10% instrument, range midpoints) × 4,370 (AC Table
  2-1, mix index 81–180 midpoint). Method and assumptions: DESIGN.md §1 "Runway capacity (ASV)" (a) and §4.
- **Not used:** the marginal column (no per-airport weather split in Table 1), ATL's Low Instrument row, and the
  newer single-airport profiles FAA posted later (e.g. ATL, DFW, ORD 2018), so that all 30 come from one table.

**Operations** are not in `data/capacity.json`: they are T-100 departures × 2 from `data/t100.json` (above), computed
when scoring, as issue #54 specifies. The issue allows FAA OPSNET/ATADS tower counts (which include general
aviation) instead if they are freely downloadable; this PR did not find or use a public file download of them, so
utilization leaves general-aviation and military operations out. **Operations = T-100 departures × 2 is therefore a
LOWER BOUND** on an airport's real operations, and so is the utilization (accepted by the owner; see DESIGN.md §1 and §4).
