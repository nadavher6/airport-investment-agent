# rank-explicit5

- **Group:** G7-rank
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
          "JFK",
          "LAX",
          "ORD",
          "ATL",
          "DEN"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Ranks all five with real sub-scores",
    "Explains the top pick"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank JFK, LAX, ORD, ATL, and DEN for investment.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["JFK","LAX","ORD","ATL","DEN"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"ORD","name":"Chicago O'Hare International","score":65.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ AS…

**Agent answer:**

**ORD leads DEN by 1.4 points (65.1 vs 63.7)**, close enough that the top two are effectively tied.

- **#1 ORD (65.1):** The busiest airfield in the set (446,836 departures in the latest 12 months), so it takes the full congestion contribution (30 points). It is held back by shrinking traffic (-1.1% per year, CY2019→CY2024) and the lowest load factor of the five (79.8%).
- **#2 DEN (63.7):** The fastest grower (3.6% per year), which earns the full growth contribution (20 points), plus solid congestion (345,892 departures). Its weak spot is long-haul: only 5.8% of seats are international, the lowest of the set.
- **#3 ATL (60.4):** The fullest planes (82.2%), giving the top unmet-demand contribution, and strong congestion (393,351 departures). Growth is roughly flat (-0.4% per year) and international share is modest (13.6%).
- **#4 JFK (53.8):** The clear international gateway. 52.9% of seats are international, above the 50% benchmark, so it gets the full long-haul contribution. But it has the fewest departures in the set (212,209), so it scores 0 on congestion, which is what drags it down.
- **#5 LAX (43.9):** It has a strong international share (30.8%) and 81.9% load factor. It is sunk by the steepest traffic decline (-2.5% per year, still below CY2019), which scores 0 on growth, and by middling congestion.

### What drives the ranking
- **Congestion and growth decide it.** These are the two categories with the widest spreads in contribution. Unmet demand barely separates anyone, since all five run between 79.8% and 82.2% full.
- **Long-haul is JFK's and LAX's edge.** It is weighted less (0.2) and can't offset their weak congestion or growth scores.

### How to read this
- **Relative scores:** The airports are scored against each other. For congestion and growth, 100 means best of these five, not of the US. Unmet demand is the load factor % itself, and long-haul is international share measured against a 50% benchmark.
- **Data coverage:** Coverage is 1 for all five, so no category is missing. Data windows are FAA CY2024 enplanements, CY2019→CY2024 growth, and the BTS T-100 latest 12 months.
- **Congestion is a volume proxy.** It counts departures, not departures relative to airfield capacity. This understates JFK, which runs a constrained, slot-limited airfield with fewer but larger flights.

A small shift in ORD's growth or DEN's departures could swap the top two. A capacity-adjusted congestion measure would likely lift JFK.
