# Place data: metros.json and regions.json

These two files are **hand-curated**, committed, and need no network or key. They only group airport codes
by place. Every number about an airport (name, city, hub size, enplanements) still comes from the FAA data
in `data/enplanements.json` (provenance: `data/raw/SOURCES.md`).

## `data/metros.json`

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

## `data/regions.json`

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
