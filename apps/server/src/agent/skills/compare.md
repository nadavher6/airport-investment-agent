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
4. **Honesty:** say how the scores read ("every score is a fixed scale on the airport's own numbers, the same as when it is scored alone: congestion is the runway utilization % and unmet demand the load factor % itself, capped at 100; long-haul is the international share out of 50%; growth is 50 + 5 × the 5-year CAGR in % per year, so −10%/yr = 0 and +10%/yr = 100"). Never describe a score as a rank among the compared airports: a 0 or a 100 is the airport's own number on the fixed scale. Then state the `coverage` and any `missing` categories, the data windows (FAA CY2024 enplanements and CY2019→CY2024 growth; BTS T-100 latest 12 months), and any `notFound` codes.
5. **Close:** one line on what would change the ranking, or what data is missing.

## Formatting rules
- Short Markdown: the bold verdict line, then `###` sections and bullets. No walls of text.
- **2 airports:** you may add ONE `compare` fence with **markdown text blocks only**, with rows such as "Strengths", "Risks" and "Best fit for". The body must be **valid JSON** (the UI parses it, and shows an error box otherwise): `{ "columns": [airport A, airport B], "rows": [{ "label": string, "cells": [[block], [block]] }] }`, exactly 2 columns, one cell per column in every row, and each cell a list of `{ "kind": "markdown", "text": string }` blocks, as in the example below. Put no number in it unless it is copied exactly from the tool result.
- **3–5 airports:** one bullet per airport, in score order ("**#1 DEN (82)**: …"). No extra table: the UI has one.
- **Never invent numbers.** Every number you quote must appear in the tool result (the only exception is the verdict's gap between two final scores).
- Do not use `chart`, `table` or `kpi` fences for score data: the score view covers it.

## Example: 2 airports (LAX vs SNA)
**LAX leads SNA by 16.5 points (66.1 vs 49.6).**

### Why
- **Congestion** is LAX's: it runs at 72.6% of its FAA-published runway capacity, past the FAA's 60% planning trigger, against 47.3% at SNA (21.8 vs 14.2 points).
- **Long-haul:** 30.8% of LAX seats are international against 2.1% at SNA, out of a 50% benchmark (12.3 vs 0.8 points).

### Trade-offs
- **Growth** is SNA's: its passengers grew 0.8% per year from CY2019 to CY2024, while LAX's shrank 2.5% per year (10.8 vs 7.5 points).
- **Unmet demand** is close: LAX planes ran 81.9% full against 79.3% at SNA (24.6 vs 23.8 points).

### How to read this
Every score is a fixed scale on the airport's own numbers, the same as when it is scored alone: congestion and unmet demand are the runway-utilization % and load factor % themselves, long-haul is the international share out of a 50% benchmark, and growth is 50 + 5 × the CAGR in % per year (LAX 37.3, SNA 54.1). Coverage is 1 for both: no category is missing.

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

More SNA international service, or a return of LAX traffic to growth, would change the gap most.

## Example: 4 airports (ATL, ORD, DFW, DEN)
**ORD leads DFW by 3.3 points (68 vs 64.7).**

- **#1 ORD (68):** the most congested (95.2% of capacity, past the FAA's 80% trigger to build) and the highest international share (16.6%), even though its passengers shrank 1.1% per year.
- **#2 DFW (64.7):** strong on growth (3.4% per year, CY2019→CY2024) and on unmet demand (81.7% full), with 15% international seats, at 69.3% of its FAA-published runway capacity.
- **#3 ATL (64.6):** the fullest planes of the four (82.2%) and 82.8% of its runway capacity, but its passengers shrank 0.4% per year; it is 0.1 points behind DFW.
- **#4 DEN (57.3):** the fastest growth (3.6% per year), but the lowest international share (5.8%) and the most runway headroom: 57.1% of capacity, below the FAA's 60% planning trigger.

### How to read this
Every score is a fixed scale on the airport's own numbers, the same as when it is scored alone: congestion and unmet demand are percentages themselves, long-haul is the international share out of 50%, and growth is 50 + 5 × the CAGR in % per year. Runway capacity for all four is the FAA's published capacity profile: ORD and ATL are past the 80% trigger, DFW and DEN are not. Coverage is 1 for all four: no category is missing. Congestion puts ORD first; growth lifts DFW and DEN, but DEN's low international share keeps it last.
