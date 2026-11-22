# mem-why

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 resolves 'the first one' to the right airport",
    "Explains using the same figures as turn 1"
  ],
  "mustNot": [
    "Ask which airport",
    "Contradict turn 1"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare LAX and SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX leads SFO by 11.1 points (66.9 vs 55.8).**

### Why
- **Congestion:** LAX ran 266,820 departures in the latest 12 months against SFO's 190,763. As the busier airfield, it takes the whole congestion contribution (30 points vs 0). This is the deciding category.
- **Long-haul:** 30.8% of LAX seats are international against 28.3% at SFO. Both are strong gateways, so the edge is small (12.3 vs 11.3 points).
- **Unmet demand:** effectively a tie. Planes ran 81.9% full at LAX and 81.7% at SFO, both near the ~80–85% level where peak-day demand starts being turned away.

### Trade-offs
- **Growth** is SFO's category. Passengers fell -2.0% per year from CY2019 to CY2024 at SFO, against -2.5% per year at LAX. That earns SFO all 20 growth points.
- Both airports are still shrinking, though. SFO's full growth score only means it declined less than LAX did. It is not a sign of real growth.

### How to read this
- **Relative scoring:** the two airports are scored against each other. For the min-max categories (congestion, growth), 100 means best of these two, not of the US. With only two airports, those categories become all-or-nothing.
- **Percentage categories:** unmet demand is the load factor % itself. Long-haul is the international share out of a 50% benchmark.
- **Coverage:** coverage is 1 for both airports, so no category is missing.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 data for the latest 12 months.
- **Congestion measure:** congestion is measured by departure volume because airfield capacity (ASV) isn't published.

```compare
{
  "columns": ["LAX", "SFO"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busier airfield with the larger international share" }], [{ "kind": "markdown", "text": "Smaller traffic decline since CY2019, with comparably full planes" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Steepest decline in passengers of the pair" }], [{ "kind": "markdown", "text": "Still shrinking, and less airfield pressure" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Airfield capacity and international terminal investment" }], [{ "kind": "markdown", "text": "Targeted modernization while traffic recovers" }]] }
  ]
}
```

A return to real growth at either airport would matter most. Adding a third airport would also make the all-or-nothing categories less extreme.

### Turn 2
**User:** Why is the first one higher?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**LAX is higher mainly because it's the busier airfield. Congestion gives it a 30-point swing that SFO's growth edge only partly offsets.**

### How the 11.1-point gap breaks down
- **Congestion (+30 for LAX):** LAX ran 266,820 departures in the latest 12 months against SFO's 190,763. With only two airports scored against each other, the busier one gets the full 30 points and the other gets 0. This is the deciding factor.
- **Growth (+20 for SFO):** SFO's passengers fell less (-2.0% per year vs -2.5%, CY2019→CY2024), so it takes all 20 growth points. This offsets most of LAX's congestion lead.
- **Long-haul (+1.0 for LAX):** 30.8% of LAX seats are international against 28.3% at SFO, worth 12.3 vs 11.3 points.
- **Unmet demand (about even):** load factors of 81.9% vs 81.7% account for only the last fraction of a point.

### Caveat
With just two airports, congestion and growth become all-or-nothing. A modest real difference (LAX's extra departures, or SFO's half-point-smaller decline) turns into the full category weight. Adding a third airport would give a more graded comparison.

I can add a comparable airport, such as SEA or SAN, to see whether LAX still leads.
