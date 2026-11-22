# cmp-lax-sfo

- **Group:** G6-compare
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "score_airports",
      "inputContains": {
        "airport_codes": [
          "LAX",
          "SFO"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Names which ranks higher",
    "Cites sub-scores / evidence for both"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare LAX and SFO for investment.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX leads SFO by 11.1 points (66.9 vs 55.8).**

### Why
- **Congestion:** LAX handled 266,820 departures in the latest 12 months against SFO's 190,763, so it takes the whole 30-point congestion contribution. SFO's 0 here only means it is the less busy of the two. It does not mean SFO's airfield is uncongested.
- **Long-haul:** 30.8% of LAX seats are international against 28.3% at SFO. This gives LAX a small edge, worth about a point.
- **Unmet demand:** this is effectively a tie. Planes ran 81.9% full at LAX and 81.7% at SFO, both in the range where peak-day demand starts to be turned away.

### Trade-offs
- **Growth** is SFO's category, and it earns the full 20 points. However, neither airport actually grew. From CY2019 to CY2024, passengers shrank by -2.0% per year at SFO and by -2.5% per year at LAX. SFO wins only because it declined less, and the relative scoring magnifies that small difference into a 20-point swing.

### How to read this
- **Scoring mode:** the airports are scored relative to each other. For congestion and growth, 100 means the best of these two, not the best in the US. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Coverage:** coverage is 1 for both airports, and no category is missing.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 for the latest 12 months.
- **Congestion limits:** congestion is a volume proxy because airfield capacity (ASV) isn't published, so it doesn't capture SFO's well-known runway constraints.

```compare
{
  "columns": ["LAX", "SFO"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busiest airfield of the two and a slightly larger international share" }], [{ "kind": "markdown", "text": "Comparable load factor and international mix, with a milder post-2019 decline" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Traffic still well below CY2019, with the steeper decline" }], [{ "kind": "markdown", "text": "Also below CY2019, and smaller volume" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Capacity and terminal expansion if traffic recovers" }], [{ "kind": "markdown", "text": "Modernization aimed at high-margin international traffic" }]] }
  ]
}
```

A return to positive growth at LAX would widen its lead. Because the margins are thin, a small shift in load factor or international share would barely move the ranking. I can also pull the full FAA enplanement history (recovery ratio, rank) for either airport if useful.
