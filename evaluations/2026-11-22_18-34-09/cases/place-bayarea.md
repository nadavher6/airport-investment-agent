# place-bayarea

- **Group:** G5-place
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "find_airports_by_city",
      "inputContains": {
        "cities": [
          "Bay Area"
        ]
      }
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Resolves Bay Area to SFO/OAK/SJC",
    "Ranks them with real data"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank the Bay Area airports for investment.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Bay Area"]})`, `score_airports({"airport_codes":["SFO","SJC","OAK"]})`
  - find_airports_by_city → ok: {"results":{"Bay Area":{"matchedAs":"metro","airports":[{"code":"SFO","name":"San Francisco International","city":"San Francisco International Airport","state":"CA","hubType":"L","latestEnplanements":25078968,"secondary":false},{"code":"SJC","name":"Norman Y Mineta San Jose International","city":"San Jose","state":"CA","hubType":"M","latestEnplanements":5822019,"secondary":false},{"code":"OAK","na…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":85.8,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

**SFO leads OAK by 52.8 points (85.8 vs 33), with SJC third (23.6).**

- **#1 SFO (85.8):** It is by far the busiest airfield, with 190,763 departures against about 47,000 at each of the others. That gives it the full congestion contribution. It also has the fullest planes (81.7%, right at the ~80–85% level where demand starts being turned away) and the highest international share (28.3%). Growth scores 100 only because it is the best of this set: passengers still shrank by -2.0% per year from CY2019 to CY2024.
- **#2 OAK (33):** Load factor (73.8%) gives it most of its points. Its international share (9.4%) and growth (-4.2% per year) are weaker but still beat SJC. On departures (47,022) it ties SJC as the least congested.
- **#3 SJC (23.6):** It carries slightly more departures (47,285) and more passengers than OAK. It is held back by the steepest decline (-5.4% per year), the lowest international share (4.4%) and the emptiest planes (72.7%).

### Why the gap is so large
- **Congestion** creates most of the spread. SFO has about four times the departures of the others, and OAK and SJC are nearly identical.
- **Growth and long-haul** widen the gap. SFO declined the least and has three to six times the international seat share of the other two.
- **Unmet demand** is the closest category: all three are within 9 points of load factor.

### How to read this
- **Scoring method:** The airports were scored relative to each other. For congestion and growth, 100 means best of these three, not of the US. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Growth caveat:** None of the three airports grew. All are below CY2019 traffic, so SFO's top growth score reflects the smallest decline, not real expansion.
- **Coverage:** Coverage is 1 for all three, with no missing categories.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 data for the latest 12 months.
- **Congestion limit:** Departures stand in for capacity pressure. Runway capacity (ASV) isn't published, so congestion relative to airfield size isn't measured.

OAK and SJC are close (9.4 points apart). A recovery in SJC traffic or stronger OAK load factors could reorder them. SFO's lead is unlikely to change unless its traffic keeps falling.
