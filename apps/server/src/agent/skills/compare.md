# Compare skill: how to compare 2–5 scored airports

You have the `score_airports` result for 2–5 airports (under "Tool results"). Compare them using the score, in the
order below, and format the answer so it reads well next to the score view.

## What the UI already shows
The UI renders the deterministic score view: side-by-side reports for 2 airports, a table sorted by final score for
3–5. **So do not retype the score table or the per-category numbers.** Your job is the reasoning.

## How to compare (in this order)
1. **Verdict first:** one bold sentence naming the leader by **final score** (`ranking[*].score`) and the gap in points (the difference of the two final scores), e.g. "**DEN leads SFO by 18 points.**"
2. **Why:** the 2–3 categories with the **largest contribution gap** (`ranking[*].breakdown[*].contribution`). Explain each in plain words, using its evidence `explanation`.
3. **Trade-offs:** where a lower-ranked airport wins a category, say so.
4. **Honesty:** state the `mode` ("scored relative to each other: for the min-max categories 100 = best of this set, not of the US; congestion is the runway utilization % and unmet demand the load factor % itself, capped at 100; long-haul is the international share out of 50%"), the `coverage` and any `missing` categories, the data windows (FAA CY2024 enplanements and CY2019→CY2024 growth; BTS T-100 latest 12 months), and any `notFound` codes.
5. **Close:** one line on what would change the ranking, or what data is missing.

## Formatting rules
- Short Markdown: the bold verdict line, then `###` sections and bullets. No walls of text.
- **2 airports:** you may add ONE `compare` fence with **markdown text blocks only**, with rows such as "Strengths", "Risks" and "Best fit for". The body must be **valid JSON** (the UI parses it, and shows an error box otherwise): `{ "columns": [airport A, airport B], "rows": [{ "label": string, "cells": [[block], [block]] }] }`, exactly 2 columns, one cell per column in every row, and each cell a list of `{ "kind": "markdown", "text": string }` blocks, as in the example below. Put no number in it unless it is copied exactly from the tool result.
- **3–5 airports:** one bullet per airport, in score order ("**#1 DEN (82)**: …"). No extra table: the UI has one.
- **Never invent numbers.** Every number you quote must appear in the tool result (the only exception is the verdict's gap between two final scores).
- Do not use `chart`, `table` or `kpi` fences for score data: the score view covers it.

## Example: 2 airports (LAX vs SNA, relative mode)
**LAX leads SNA by 4.1 points (62.9 vs 58.8).**

### Why
- **Congestion:** LAX runs at 86.8% of its estimated runway capacity, past the FAA's 80% trigger to build, against 47.3% at SNA (26 vs 14.2 points).
- **Long-haul:** 30.8% of LAX seats are international against 2.1% at SNA, out of a 50% benchmark (12.3 vs 0.8 points).
- **Unmet demand:** LAX planes ran 81.9% full against 79.3% at SNA, so more of its peak-day demand is turned away.

### Trade-offs
- **Growth** is SNA's category and almost closes the gap: passengers grew 0.8% per year from CY2019 to CY2024, while LAX shrank by -2.5% per year (20 vs 0 points).

### How to read this
Scored relative to each other (for growth, the min-max category, 100 = best of these two, not of the US; congestion and unmet demand are the runway-utilization % and load factor % themselves, and long-haul is the international share out of 50%). Coverage is 1 for both: no category is missing.

```compare
{
  "columns": ["LAX", "SNA"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "A congested, international gateway" }], [{ "kind": "markdown", "text": "Steady growth" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Traffic still below CY2019" }], [{ "kind": "markdown", "text": "Small and almost all domestic" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Capacity and terminal expansion" }], [{ "kind": "markdown", "text": "Incremental modernization" }]] }
  ]
}
```

A return of LAX traffic to growth would widen the gap; more SNA international service would narrow it.

## Example: 4 airports (ATL, ORD, DFW, DEN, relative mode)
**DFW leads DEN by 3.4 points (80 vs 76.6).**

- **#1 DFW (80):** strong on growth (3.4% per year, CY2019→CY2024) and on unmet demand (81.7% full), with 15% international seats, and at 117% of its estimated runway capacity.
- **#2 DEN (76.6):** the fastest growth (3.6% per year), but the lowest international share (5.8%). Its 205% runway utilization is overstated: it has 6 runways and the closest FAA configuration has 2.
- **#3 ATL (63.4):** the fullest planes of the set (82.2%) and 127.9% of its estimated runway capacity, but growth is flat at -0.4% per year.
- **#4 ORD (60.6):** the highest international share (16.6%) and 145.3% of its estimated runway capacity, held back by -1.1% per year growth and 79.8% load factor.

### How to read this
Scored relative to each other (for growth, the min-max category, 100 = best of these four, not of the US; congestion and unmet demand are percentages themselves, and long-haul is the international share out of 50%). All four are past 100% of their estimated runway capacity, so congestion is capped at 100 for each and does not separate them. Coverage is 1 for all four: no category is missing. Growth decides the order: DFW and DEN lead on it, while ATL and ORD are within 2.8 points of each other.
