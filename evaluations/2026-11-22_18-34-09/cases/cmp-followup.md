# cmp-followup

- **Group:** G6-compare
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 gives a clear recommendation grounded in the turn-1 sub-scores",
    "Explains the trade-off (e.g. growth vs long-haul)"
  ],
  "mustNot": [
    "Invent figures",
    "Contradict turn 1"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare DEN and PHX for investment.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["DEN","PHX"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"DEN","name":"Denver International","score":76.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","inp…

**Agent answer:**

**DEN leads PHX by 50.7 points (76.6 vs 25.9).**

### Why
- **Congestion:** DEN handled 345,892 departures in the latest 12 months against PHX's 221,624. Because this category is min-max scaled within the pair, DEN takes the full 30 points and PHX gets 0. Departure volume stands in for capacity pressure, since the airfield capacity figure (ASV) isn't freely published.
- **Growth:** DEN passengers grew 3.6% per year from CY2019 to CY2024, against 2.7% at PHX. This category is also min-max scaled, so DEN takes all 20 points and PHX gets 0 even though PHX is growing too.
- These two categories account for almost the entire gap. The others are nearly tied.

### Trade-offs
- **PHX doesn't win any category, but it is close on two.**
  - **Unmet demand:** planes ran 79.1% full at PHX against 80.8% at DEN.
  - **Long-haul:** 5.4% of PHX seats are international against 5.8% at DEN.
- **Neither airport is a strong long-haul play.** Both sit far below the 50% international benchmark.
- **The score overstates the real-world gap.** With only two airports, the min-max scaling turns modest differences into all-or-nothing results. PHX is still a growing and busy airport, just less so than DEN.

### How to read this
- **Mode:** the airports are scored relative to each other. For congestion and growth, 100 means the best of these two, not of the US. Unmet demand is the load factor % itself, and long-haul is the international share measured against 50%.
- **Coverage:** 1 for both airports, so no category is missing.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 for the latest 12 months.

```compare
{
  "columns": ["DEN", "PHX"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busier airfield, faster growth and the fullest planes of the pair" }], [{ "kind": "markdown", "text": "Solid, positive growth and load factor close to DEN's" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Low international share limits high-margin traffic" }], [{ "kind": "markdown", "text": "Less capacity pressure and an equally thin international mix" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Airfield and terminal capacity expansion" }], [{ "kind": "markdown", "text": "Targeted modernization ahead of continued growth" }]] }
  ]
}
```

PHX would narrow the gap mainly by out-growing DEN or by adding international service. Adding more airports to the comparison would also give a less binary, more realistic picture of where each one stands.

### Turn 2
**User:** Which one should I prioritize and why?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**Prioritize DEN.** It leads PHX by 50.7 points (76.6 vs 25.9) and is ahead in every category of the score.

### Why DEN
- **More capacity pressure:** DEN handled 345,892 departures in the latest 12 months against PHX's 221,624. Expansion pays off most where the airfield is already busiest, because new capacity gets used.
- **Faster growth:** DEN passengers grew 3.6% per year from CY2019 to CY2024, against 2.7% at PHX. Faster growth means added capacity fills sooner and the payback is quicker.
- **Slightly fuller planes:** DEN ran 80.8% full against 79.1% at PHX. This points to a bit more demand that airlines currently can't serve.

### Why not a landslide
- **The 50.7-point gap is exaggerated.** With only two airports, congestion and growth are scaled all-or-nothing, so PHX scores 0 on both even though it is growing and busy. On the underlying figures, DEN is clearly ahead but not dominant.
- **Neither airport is a long-haul play.** International seats are 5.8% at DEN and 5.4% at PHX, so high-margin international traffic won't drive returns at either one.

### What this doesn't cover
The score measures demand-side attractiveness only. It doesn't include construction cost, existing expansion projects, gate or land availability, or airline commitments, and any of these could change the profitability picture.

I can add one or two peer airports to the comparison for a less binary ranking, or pull the full FAA enplanement trends for either airport.
