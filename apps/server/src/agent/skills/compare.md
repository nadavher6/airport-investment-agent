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
**SNA and LAX are effectively tied: SNA leads by 0.1 points (58.8 vs 58.7).**

### Why
- **Growth** decides it: SNA passengers grew 0.8% per year from CY2019 to CY2024, while LAX shrank by -2.5% per year (20 vs 0 points).
- **Congestion** is LAX's: it runs at 72.6% of its FAA-published runway capacity, past the FAA's 60% planning trigger, against 47.3% at SNA (21.8 vs 14.2 points).
- **Long-haul:** 30.8% of LAX seats are international against 2.1% at SNA, out of a 50% benchmark (12.3 vs 0.8 points).

### Trade-offs
- **Unmet demand** is close: LAX planes ran 81.9% full against 79.3% at SNA (24.6 vs 23.8 points).

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

A return of LAX traffic to growth would put it ahead; more SNA international service would widen SNA's lead.

## Example: 4 airports (ATL, ORD, DFW, DEN, relative mode)
**DFW leads DEN by 7.1 points (70.8 vs 63.7).**

- **#1 DFW (70.8):** strong on growth (3.4% per year, CY2019→CY2024) and on unmet demand (81.7% full), with 15% international seats, at 69.3% of its FAA-published runway capacity.
- **#2 DEN (63.7):** the fastest growth (3.6% per year), but the lowest international share (5.8%) and the most runway headroom: 57.1% of capacity, below the FAA's 60% planning trigger.
- **#3 ORD (59.1):** the most congested (95.2% of capacity, past the FAA's 80% trigger to build) and the highest international share (16.6%), held back by -1.1% per year growth.
- **#4 ATL (58.2):** the fullest planes of the set (82.2%) and 82.8% of its runway capacity, but growth is flat at -0.4% per year.

### How to read this
Scored relative to each other (for growth, the min-max category, 100 = best of these four, not of the US; congestion and unmet demand are percentages themselves, and long-haul is the international share out of 50%). Runway capacity for all four is the FAA's published capacity profile, so congestion now separates them: ORD and ATL are past the 80% trigger, DFW and DEN are not. Coverage is 1 for all four: no category is missing. Growth puts DFW and DEN ahead, while ORD and ATL are within 0.9 points of each other.
