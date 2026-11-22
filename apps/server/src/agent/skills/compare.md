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
4. **Honesty:** state the `mode` ("scored relative to each other: 100 = best of this set, not of the US"), the `coverage` and any `missing` categories, the data windows (FAA CY2024 enplanements and CY2019→CY2024 growth; BTS T-100 latest 12 months), and any `notFound` codes.
5. **Close:** one line on what would change the ranking, or what data is missing.

## Formatting rules
- Short Markdown: the bold verdict line, then `###` sections and bullets. No walls of text.
- **2 airports:** you may add ONE `compare` fence with **markdown text blocks only**, with rows such as "Strengths", "Risks" and "Best fit for". The body must be **valid JSON** (the UI parses it, and shows an error box otherwise): `{ "columns": [airport A, airport B], "rows": [{ "label": string, "cells": [[block], [block]] }] }`, exactly 2 columns, one cell per column in every row, and each cell a list of `{ "kind": "markdown", "text": string }` blocks, as in the example below. Put no number in it unless it is copied exactly from the tool result.
- **3–5 airports:** one bullet per airport, in score order ("**#1 DEN (82)**: …"). No extra table: the UI has one.
- **Never invent numbers.** Every number you quote must appear in the tool result (the only exception is the verdict's gap between two final scores).
- Do not use `chart`, `table` or `kpi` fences for score data: the score view covers it.

## Example: 2 airports (LAX vs SNA, relative mode)
**LAX leads SNA by 60 points (80 vs 20).**

### Why
- **Congestion:** LAX handled 266,820 departures in the latest 12 months against SNA's 51,447, so it takes the whole congestion contribution (30 points).
- **Unmet demand:** LAX planes ran 81.9% full against 79.3% at SNA, so more of its peak-day demand is turned away.
- **Long-haul:** 30.8% of LAX seats are international against 2.1% at SNA.

### Trade-offs
- **Growth** is SNA's category: passengers grew 0.8% per year from CY2019 to CY2024, while LAX shrank by -2.5% per year.

### How to read this
Scored relative to each other (100 = best of these two, not of the US). Coverage is 1 for both: no category is missing.

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
**DFW leads ATL by 2.5 points (64.3 vs 61.8).**

- **#1 DFW (64.3):** strong on growth (3.4% per year, CY2019→CY2024) and on unmet demand (81.7% full).
- **#2 ATL (61.8):** the fullest planes of the set (82.2%), which gives it the whole unmet-demand contribution, but growth is flat at -0.4% per year.
- **#3 ORD (50):** the busiest airfield (446,836 departures) and the highest international share (16.6%), held back by -1.1% per year growth and 79.8% load factor.
- **#4 DEN (32.5):** the fastest growth (3.6% per year), but the lowest international share (5.8%).

### How to read this
Scored relative to each other (100 = best of these four, not of the US). Coverage is 1 for all four: no category is missing. DFW and ATL are close, so a small change in load factor or growth could swap them.
