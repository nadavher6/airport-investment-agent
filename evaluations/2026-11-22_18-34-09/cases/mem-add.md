# mem-add

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "score_airports",
      "optional": true,
      "inputContains": {
        "airport_codes": [
          "DEN"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Turn 2 re-ranks including Denver"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank LAX and SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX leads SFO by 11.1 points (66.9 vs 55.8).**

### Why
- **Congestion is the decisive category.** LAX handled 266,820 departures in the latest 12 months against SFO's 190,763. In a two-airport min-max comparison, that gives LAX the full 30-point congestion contribution and SFO none. The metric is a volume proxy, because runway capacity (ASV) isn't published, so it shows which airfield is busier rather than which is truly more constrained.
- **Long-haul adds a small edge for LAX.** 30.8% of LAX seats are international against 28.3% at SFO, worth about 1 point.
- **Unmet demand is effectively a tie.** Planes ran 81.9% full at LAX and 81.7% at SFO. Both are near the ~80–85% level where peak-day demand starts getting turned away, so this category supports expansion at both airports.

### Trade-offs
- **Growth is SFO's only win, and it's a relative one.** Both airports are still shrinking. Passengers fell -2.0% per year at SFO and -2.5% per year at LAX from CY2019 to CY2024. SFO gets all 20 growth points only because it declined less, not because it is growing.

### How to read this
- **Relative scoring:** the airports are scored against each other. For congestion and growth, 100 means best of these two, not of the US. Unmet demand is the load factor % itself, and long-haul is scored against a 50% international benchmark.
- **Coverage:** coverage is 1 for both, so no category is missing.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 for the latest 12 months.

```compare
{
  "columns": ["LAX", "SFO"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busier airfield and slightly higher international share" }], [{ "kind": "markdown", "text": "Smaller traffic decline since CY2019 and comparably full planes" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Steepest decline of the pair; traffic still below CY2019" }], [{ "kind": "markdown", "text": "Also still shrinking; growth lead is relative only" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Capacity and international terminal expansion, contingent on recovery" }], [{ "kind": "markdown", "text": "Targeted modernization to capture recovering demand" }]] }
  ]
}
```

The congestion gap carries the whole lead. Scoring both airports against all US airports, or a return to positive growth at either one, would give a fuller picture. I can run either if useful.

### Turn 2
**User:** Add Denver.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Denver"]})`, `score_airports({"airport_codes":["LAX","SFO","DEN"]})`
  - find_airports_by_city → ok: {"results":{"Denver":{"matchedAs":"metro","airports":[{"code":"DEN","name":"Denver International","city":"Denver","state":"CO","hubType":"L","latestEnplanements":40012895,"secondary":false}]}}}
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"DEN","name":"Denver International","score":76.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","inp…

**Agent answer:**

**DEN leads LAX by 25 points (76.6 vs 51.6), with SFO third (37.5).**

- **#1 DEN (76.6):** It is the only airport of the three that is growing. Passengers grew 3.6% per year from CY2019 to CY2024, which earns it the full growth contribution. It is also the busiest airfield of the set, with 345,892 departures in the latest 12 months, so it takes the full congestion contribution too. Its planes run 80.8% full, close to the other two. Its weak spot is long-haul: only 5.8% of its seats are international.
- **#2 LAX (51.6):** It has the highest international share (30.8%) and the fullest planes (81.9%). It loses ground on growth, where passengers fell -2.5% per year. Its congestion score also drops to mid-range because DEN, not LAX, is now the busiest airfield in the set.
- **#3 SFO (37.5):** It has a strong international share (28.3%) and planes that run 81.7% full. It is held back by the fewest departures of the three (190,763) and by a decline of -2.0% per year.

### Why the ranking moved
- **Growth and congestion decide it.** DEN beats LAX on both, and those two categories outweigh LAX's lead on long-haul.
- **Unmet demand barely separates them.** All three load factors fall between 80.8% and 81.9%, which is near the level where peak-day demand starts getting turned away. This category supports expansion at all three airports.
- **The earlier scores changed because the comparison set changed.** Congestion and growth are scored relative to the best airport in the set. With DEN added, LAX is no longer the busiest airfield, and SFO's smaller decline is no longer the best growth figure. As a result, LAX fell from 66.9 to 51.6 and SFO from 55.8 to 37.5, even though their underlying data did not change.

### How to read this
- **Relative scoring:** for congestion and growth, 100 means the best of these three airports, not the best in the US. Unmet demand is the load factor % itself. Long-haul is the international seat share scored against a 50% benchmark.
- **Coverage:** coverage is 1 for all three, so no category is missing.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 for the latest 12 months.
- **Caveat:** congestion counts departures as a stand-in for capacity pressure, because runway capacity (ASV) isn't published. It shows how busy an airfield is, not how close it is to its actual limit.

A shift toward more international service at DEN, or a return to growth at LAX, would narrow the gap. I can also score any of these airports against all US airports if useful.
