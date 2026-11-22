# mem-switch

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 switches focus to MIA",
    "Doesn't keep answering about LAX/SFO"
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
- **Congestion:** LAX handled 266,820 departures in the latest 12 months against SFO's 190,763. In a two-airport comparison the busier field takes the whole congestion contribution (30 points), and this is the decisive gap.
- **Unmet demand and long-haul are nearly tied:** planes ran 81.9% full at LAX against 81.7% at SFO, and 30.8% of LAX seats are international against 28.3% at SFO. LAX edges both, by about one point combined.

### Trade-offs
- **Growth** is SFO's category and claws back 20 points. However, neither airport is actually growing: SFO passengers shrank -2.0% per year from CY2019 to CY2024, against -2.5% per year at LAX. SFO wins the category only because it shrank less. The min-max scale turns a gap of about half a point into a 100-vs-0 split.

### How to read this
- **Scoring mode:** the airports are scored relative to each other. For congestion and growth, 100 means the best of these two, not of the US, so small real differences are amplified.
- **Absolute categories:** unmet demand is the load factor % itself, and long-haul is the international share scored against a 50% benchmark.
- **Coverage:** coverage is 1 for both, so no category is missing.
- **Data windows:** FAA CY2024 enplanements and CY2019→CY2024 growth; BTS T-100 for the latest 12 months.
- **Congestion caveat:** the congestion score uses departures as a stand-in for capacity pressure, because airfield capacity (ASV) isn't published.

```compare
{
  "columns": ["LAX", "SFO"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busier airfield, slightly fuller planes and a slightly higher international share" }], [{ "kind": "markdown", "text": "Smaller traffic decline since CY2019; similar load factor and international mix" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Fastest decline of the pair since CY2019" }], [{ "kind": "markdown", "text": "Traffic still shrinking since CY2019; less volume pressure" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Capacity and international terminal investment, if traffic recovers" }], [{ "kind": "markdown", "text": "Modernization over expansion until growth returns" }]] }
  ]
}
```

A return to growth at LAX would widen its lead. Because both airports are this close on demand and international mix, adding a third airport to the comparison could reshuffle the min-max categories noticeably.

### Turn 2
**User:** Actually, let's look at Miami instead.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Miami"]})`, `score_airports({"airport_codes":["MIA","FLL","PBI"]})`
  - find_airports_by_city → ok: {"results":{"Miami":{"matchedAs":"metro","airports":[{"code":"MIA","name":"Miami International","city":"Miami","state":"FL","hubType":"L","latestEnplanements":26588002,"secondary":false},{"code":"FLL","name":"Fort Lauderdale/Hollywood International","city":"Fort Lauderdale","state":"FL","hubType":"L","latestEnplanements":17096131,"secondary":false},{"code":"PBI","name":"Palm Beach International","…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"MIA","name":"Miami International","score":92.2,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","inpu…

**Agent answer:**

**MIA leads the Miami metro set with 92.2, 7.6 points ahead of PBI (84.6), but PBI's score rests on growth alone, so the real comparison is MIA vs FLL (30.9), a 61.3-point gap.**

- **#1 MIA (92.2):** It tops nearly every category.
  - **Busiest airfield:** 220,368 departures in the latest 12 months, so it takes the full congestion contribution.
  - **Strongest growth:** 4.4% per year from CY2019 to CY2024.
  - **Most international:** 44.7% of seats are international, close to the 50% benchmark. This is high-margin traffic that is hard for competitors to replicate.
  - **Fullest planes:** 81% full, slightly above FLL.
- **#2 PBI (84.6), not a like-for-like score:** There is no BTS T-100 record for PBI, so congestion, unmet demand and long-haul are all missing (coverage 0.2). Its score comes only from growth, which was a solid 3.6% per year from CY2019 to CY2024 (84.6 relative to this set). Treat it as a growth signal, not an overall rank.
- **#3 FLL (30.9):** Three gaps account for almost all of its deficit to MIA.
  - **Congestion:** 116,709 departures, the lowest of the scored airports, so it gets 0 on this relative scale.
  - **Growth:** passengers shrank 1.0% per year, which also scores 0.
  - **Long-haul:** a 17.5% international share.
  - **Its one competitive category:** unmet demand. At 79.6% full, FLL is only 0.4 contribution points behind MIA.

### How to read this
- **Scoring mode:** the airports are scored relative to each other. For congestion and growth, 100 means the best of these three, not of the US, which exaggerates FLL's zeros.
- **Absolute categories:** unmet demand is the load factor % itself, and long-haul is the international share scored against a 50% benchmark.
- **Coverage:** 1 for MIA and FLL; 0.2 for PBI, which is missing congestion, unmet demand and long-haul.
- **Data windows:** FAA CY2024 enplanements and CY2019→CY2024 growth; BTS T-100 for the latest 12 months.
- **Congestion caveat:** departures stand in for capacity pressure, because airfield capacity (ASV) isn't published.

Full T-100 data for PBI is the main thing that could change the order. As a mostly domestic medium hub, it would likely fall below MIA on congestion and long-haul. I can also score MIA on its own against all US airports, or set it against LAX and SFO from earlier.
