# Task 1 — Acquire FAA Enplanement Data (10 years)

**Objective:** Download the official FAA passenger-boarding (enplanement) files for
**CY2015–CY2024** into `data/raw/`, one file per year.

## Source

FAA → *Airports → Planning & Capacity → Passenger Boarding and All-Cargo Data*:

> https://www.faa.gov/airports/planning_capacity/passenger_allcargo_stats/passenger

Each calendar year has a **"Commercial Service Enplanements"** (a.k.a. "Passenger
Boarding Data") file in **Excel**. The FAA keeps the recent years on the main page and
older years in the **archive** linked from it.

> ⚠️ **The FAA blocks automated/CLI downloads** (returns HTTP 403 to non-browser
> clients). Expect to download via a real browser, or by passing a browser-like
> `User-Agent` to `curl`. Exact filenames/paths change year to year — always grab the
> link from the page rather than guessing the URL.

## What to download

For **each** year CY2015 … CY2024, download the **"Commercial Service"** enplanement
workbook (the one that lists every commercial airport with its hub type and
enplanements). Prefer the **final** file over any "preliminary" version.

Save into `data/raw/` with a normalized name so the build script can glob them:

```
data/raw/faa-enplanements-cy2015.xlsx
data/raw/faa-enplanements-cy2016.xlsx
...
data/raw/faa-enplanements-cy2024.xlsx
```

## How to download

### Option A — Browser (most reliable)
1. Open the FAA page above.
2. For each year, click the "Commercial Service Enplanements" Excel link.
3. Rename the file to the `faa-enplanements-cyYYYY.xlsx` convention and move it to `data/raw/`.
4. For years 2015–2021, use the **"Previous Years"/archive** link on that page.

### Option B — curl with a browser User-Agent
If a direct file URL is known from the page, in the Claude Code session run it with
the `!` prefix so output lands in the chat:

```bash
! curl -L -A "Mozilla/5.0" -o data/raw/faa-enplanements-cy2024.xlsx "<FAA_FILE_URL>"
```

(Repeat per year. `-A` sets a browser User-Agent to get past the 403.)

## Expected file shape

Each workbook has a header row then one row per airport. Columns are roughly:

| Column (FAA) | Example | Maps to |
|---|---|---|
| Rank | 2 | `nationalRank` |
| RO (region) | AWP | (ignore) |
| Locid | LAX | `airportCode` |
| City | Los Angeles | `city` |
| State | CA | `state` |
| Airport Name | Los Angeles Intl | `name` |
| Hub | L | `hubType` (L/M/S/N) |
| CY Enplanements | 65,000,000 | `enplanements` |
| Prior CY Enplanements | 48,000,000 | `priorYear` |
| % Change | +35.0% | `yoyChangePct` |

> Column **headers and order drift between years** — the build script (Task 2) must
> match columns by **fuzzy header name**, not by fixed position.

## Acceptance criteria

- [ ] 10 files present in `data/raw/`, named `faa-enplanements-cy2015.xlsx` … `cy2024.xlsx`
- [ ] Each opens and contains a per-airport table with a hub column and an enplanement column
- [ ] Files are **gitignored** (large/binary) — only the built JSON is committed

## Notes

- `data/raw/` is already created and should be added to `.gitignore`.
- If the FAA only offers a given year as `.xls` (old format) or PDF, note it — the
  build script handles `.xlsx`/`.xls`/`.csv`; a PDF-only year must be converted first.
- Keep a short `data/raw/SOURCES.md` listing, per year, the exact URL you downloaded
  from and the date — provenance matters for an investment tool.
