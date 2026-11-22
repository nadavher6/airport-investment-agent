# single-sfo-unmet

- **Group:** G4-single
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
          "SFO"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Explains unmet demand via load factor",
    "Notes it is a proxy"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** What is the unmet demand at SFO and why?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["SFO"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":89.5,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

## Unmet demand at SFO: high

**Unmet-demand sub-score: 98.9 / 100** (absolute, compared with all U.S. airports). It adds 29.7 points to SFO's overall Investment Attractiveness Score of **89.5**.

### What the number is based on
The score uses **load factor**, which is passengers divided by seats, from BTS T-100 data for the latest 12 months:

| Input | Value |
|---|---|
| Passengers | 26,498,215 |
| Seats offered | 32,451,463 |
| **Load factor** | **81.7%** |

On average, flights at SFO were 81.7% full. That is above the ~80% level where spill becomes material. Spill means travelers who wanted a seat on a peak day or peak flight and were turned away or pushed to another time or airport. An *average* of nearly 82% means peak flights are likely running close to full.

### Why demand is going unmet
1. **Seats are scarce compared with demand.** The airport's other indicators point to supply, not weak demand, as the limit:
   - **Congestion: 100 / 100.** SFO had 190,763 departures in the last 12 months, among the busiest airfields in the country. Note that this measures traffic volume, not true capacity use, because the FAA's annual service volume figure isn't freely published.
   - **Long-haul share: 100 / 100.** 28.3% of seats (9,195,944) are international. Widebody international flights take up gates, customs (FIS) capacity and runway slots, which leaves less room for additional domestic seats.

2. **Demand is outrunning a smaller seat supply.** SFO's growth is weak:
   - 5-year enplanement CAGR is **–2.0% per year**.
   - 2024 enplanements were 25,078,968, about **90% of 2019 levels** (recovery ratio 0.9028).
   
   High load factors combined with traffic still below 2019 suggest airlines have restored seats more slowly than passengers have come back. The demand that does exist is being packed into fewer seats.

3. **Likely physical constraints (qualitative, not in the tool data).** SFO is widely known for closely spaced parallel runways that lose capacity in low visibility, which limits how much the airport can add at peak times. This is general context, and the tool did not quantify it.

### Caveats
- Load factor is a *proxy* for unmet demand. It can't tell the difference between spill caused by airport limits and airlines choosing to fly fuller planes for profit.
- The figure is a 12-month average. Peak-hour and seasonal spill is likely higher but isn't measured here.
- The growth input is labeled FY2019→FY2024. The underlying FAA enplanement series is calendar-year, so treat the CAGR as approximate.

### Investment takeaway
SFO shows strong signs of unmet demand. Demand pressure looks durable, but the negative growth trend shows that adding seats there is difficult. Projects that relieve bottlenecks (gates, FIS capacity, airfield and low-visibility throughput) would likely pay off more than general terminal expansion. I can also score SFO against OAK and SJC to see whether Bay Area demand is spilling over to those airports.
