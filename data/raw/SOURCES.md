# FAA enplanement source files: provenance

The workbooks themselves are gitignored. This file records where each one came from, so the dataset can be
reproduced and checked. Re-download with `npm run data:download` (`-- --force` to replace existing files).

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
| 2017 | `faa-enplanements-cy2017.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy17-commercial-service-enplanements.xlsx | 58348 | `ab4d69b900371256985f58eb744ccb4a8976d624db5b12a9dfc26fa9a9f89df5` | 514 |
| 2018 | `faa-enplanements-cy2018.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy18-commercial-service-enplanements.xlsx | 58016 | `88a53435e846b4fcb4a602c94c6b5b4a240c7e1cf74b991733604d175510b47b` | 522 |
| 2019 | `faa-enplanements-cy2019.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy19-commercial-service-enplanements.xlsx | 64611 | `84924e4a4500e3e1e2fc74b5720c92ad50302618f7357f46fcfe07eefc099bce` | 523 |
| 2020 | `faa-enplanements-cy2020.xlsx` | https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/passenger_allcargo_stats/passenger/cy20-commercial-service-enplanements.xlsx | 53222 | `91b00a4643a35a27bd975c14ef111066838ace9b36c2d034c49c5920e964ab10` | 448 |
| 2021 | `faa-enplanements-cy2021.xlsx` | https://www.faa.gov/sites/faa.gov/files/2022-09/cy21-commercial-service-enplanements.xlsx | 57140 | `41dcbb24d5209662803f4182cb27a6cc60086ad70b5bb24d619a48b08bca551b` | 480 |
| 2022 | `faa-enplanements-cy2022.xlsx` | https://www.faa.gov/sites/faa.gov/files/2023-09/cy22-commercial-service-enplanements.xlsx | 57395 | `629652c78756edc22b56a4cf7eaeed09988d8d10c81aa5dbd1c0faa0f424cef7` | 509 |
| 2023 | `faa-enplanements-cy2023.xlsx` | https://www.faa.gov/sites/faa.gov/files/2024-10/cy23-commercial-service-enplanements.xlsx | 56743 | `653fe78e925fe85d0155fd8f5230a57bc437786cd7ed44bcd7a34d942ed2cdd1` | 502 |
| 2024 | `faa-enplanements-cy2024.xlsx` | https://www.faa.gov/sites/faa.gov/files/2026-09/arp-cy2024-commercial-service-enplanements.xlsx | 58202 | `bbba0541110c790021967d52591d60c8af852b8350831c9c26cfb91be7b3e13c` | 516 |

Check local copies with:

```bash
cd data/raw && shasum -a 256 faa-enplanements-cy*.xlsx
```

## Format notes (for Task 2: build the dataset)

Checked by reading every workbook on download day.

- **All 10 are `.xlsx`.** No `.xls` or PDF-only years, so no conversion is needed.
- **Headers are identical across all 10 years**, on row 1:
  `Rank, RO, ST, Locid, City, Airport Name, S/L, Hub, CY YY Enplanements, CY YY-1 Enplanements, % Change`.
  The enplanement headers carry the 2-digit year (`CY 24 Enplanements`), so match them by pattern, not by exact text.
- **`% Change` is a fraction, not a percent**: `0.0306` means +3.06%. Some cells are in scientific notation (`5.87E-2`).
- **CY2016 has two sheets** (`ChangeinRevenuePassengerEnplan`, `Sheet1`). The data is in the first one. Some sheet names
  have a trailing space.
- **`S/L`** is the service level (`P` = primary, `N` = non-primary). **`Hub`** is `L`/`M`/`S`/`N`.
- **Airport names drift between years** (e.g. `Hartsfield - Jackson Atlanta International` →
  `Hartsfield/Jackson Atlanta International` in CY2023). Key on `Locid`, not on the name.
- **Years chain correctly:** each file's prior-year column matches the previous file. For example, ATL CY23 =
  50,950,068 appears both as CY2023's current value and as CY2024's prior-year value.
- **CY2025 exists** on the FAA's current-year page (`arp-cy2025-commercial-service-enplanements.xlsx`). It's left out
  here because the task scope is CY2015–CY2024.
