# Tasks — 10-Year Local Enplanement Lookup

> **Goal:** Replace mocked passenger-volume data with a **real, local, deterministic
> lookup of official FAA enplanement data for the last 10 calendar years
> (CY2015–CY2024)**, and expose it to the agent as a tool: `get_enplanements(code)`.
>
> This directly implements **criterion #1 (Enplanements — total + trend)** from
> [`../02-traffic-and-demand.md`](../02-traffic-and-demand.md).

## Why local, not an API

Enplanement statistics are **published once a year** by the FAA as Excel/CSV files —
there is **no clean public REST API** for them. A runtime API call for annual data is
pointless; a **cached local dataset** is strictly better:

- ✅ Official FAA numbers (accurate, citable)
- ✅ Instant, offline, no key, no rate limits, no failure mode
- ✅ Fits this project's **deterministic scoring** philosophy (see `../DESIGN.md`)
- 🔁 Refresh once a year when the FAA posts a new file

## Scope

- **Years:** CY2015 → CY2024 (10 calendar years). Add CY2025 when the FAA posts it.
- **Airports:** all U.S. commercial-service airports in the FAA file (~500/year).
- **Fields per airport-year:** hub type, enplanements, prior-year, % change, national rank.
- **Derived:** 5-year and 10-year CAGR, latest year, recovery-vs-2019 ratio.

## How it fits the monorepo

This is a **TypeScript npm-workspaces** repo (see `../README.md`). The lookup lands as:

```
data/
  raw/                         # downloaded FAA source files (gitignored, large)
    faa-enplanements-cy2015.xlsx ... cy2024.xlsx
  enplanements.json            # built, committed, loaded at runtime (small)
packages/ or apps/server/
  src/data/enplanements/
    build.ts                   # parse data/raw/*.xlsx -> data/enplanements.json
    lookup.ts                  # load json + get_enplanements(code)
    lookup.test.ts             # vitest
  src/agent/tools/
    getEnplanements.ts         # tool definition the agent can call
```

Runtime loads the small committed `enplanements.json` (~50k rows ≈ a few MB) into
memory — no native deps, no DB engine needed.

## Task index

| # | Task | File | Output |
|---|------|------|--------|
| 1 | Acquire FAA data | [`01-acquire-faa-data.md`](./01-acquire-faa-data.md) | `data/raw/*.xlsx` (10 files) |
| 2 | Build the dataset | [`02-ingest-build-dataset.md`](./02-ingest-build-dataset.md) | `data/enplanements.json` |
| 3 | Expose the tool | [`03-enplanements-tool.md`](./03-enplanements-tool.md) | `get_enplanements()` tool |
| 4 | Validate & test | [`04-validation-and-tests.md`](./04-validation-and-tests.md) | passing vitest + spot checks |

## Definition of done

- [ ] 10 FAA files downloaded to `data/raw/`
- [ ] `data/enplanements.json` built, committed, schema-validated
- [ ] `get_enplanements("LAX")` returns real totals + hub type + CAGR in < 5 ms
- [ ] Agent can call the tool and cites real enplanement figures in its briefs
- [ ] Tests pass; `DESIGN.md` updated to note the real data source
