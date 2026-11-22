# single-den-score

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
          "DEN"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Reports DEN's score and the category breakdown",
    "Explains it's absolute vs all US airports"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Give me Denver's investment attractiveness score.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Denver"]})`, `score_airports({"airport_codes":["DEN"]})`
  - find_airports_by_city → ok: {"results":{"Denver":{"matchedAs":"metro","airports":[{"code":"DEN","name":"Denver International","city":"Denver","state":"CO","hubType":"L","latestEnplanements":40012895,"secondary":false}]}}}
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"DEN","name":"Denver International","score":84.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","inp…

**Agent answer:**

**Denver International (DEN): 84.6 / 100**

This is an **absolute** score, comparing DEN against all U.S. airports. DEN is the only airport serving the Denver metro in the data, and all four scoring categories had data (coverage 100%).

| Category | Weight | Sub-score | Contribution | Key input |
|---|---|---|---|---|
| Congestion / capacity pressure | 30% | 100.0 | 30.0 | 345,892 departures (latest 12 months) |
| Unmet demand (load factor) | 30% | 97.2 | 29.2 | 80.8% load factor (40.2M passengers / 49.8M seats) |
| Long-haul share | 20% | 55.2 | 11.0 | 5.8% international seats (~2.9M) |
| Growth / durability | 20% | 72.2 | 14.4 | 3.6% 5-yr enplanement CAGR; 2024 traffic at 119% of 2019 |
| **Total** | | | **84.6** | |

**What the score means**

- **Capacity pressure is very high.** DEN gets the top congestion sub-score because its airfield handles a very large number of departures. Its planes average about 81% full. That is close to the 80–85% range where airlines start turning away passengers on peak days. These two categories supply most of the score (59.2 of 84.6 points).
- **Growth has been steady.** DEN had 40.0M enplanements in 2024, up 19% from 2019, or about 3.6% per year. That points to durable demand rather than a one-time rebound.
- **International traffic is the weak spot.** Only 5.8% of seats are international. That limits exposure to the higher-margin traffic that comes with customs facilities and weight-based fees. If DEN grows its international service, that would be the main way to raise the score.

**Bottom line:** DEN looks like a strong candidate for capacity expansion, mainly because of heavy airfield use and full planes rather than international traffic.

**Assumptions and data limits**

- **Congestion is measured by departure volume, not true utilization.** The proper measure divides operations by the airfield's annual service volume, but that capacity figure isn't freely published. So the score reflects how busy DEN is, not how close it is to its actual limit. DEN has six runways and a lot of land, so its real airfield constraint may be lower than this sub-score suggests. Terminal and gate capacity are not captured at all.
- **Time periods differ by category.** Load factor and international share use the latest 12 months of BTS T-100 data. Growth uses FAA enplanements from 2019 to 2024.
- **Demand is not profit.** The score doesn't include construction costs, airline lease terms, debt capacity, or projects already planned or underway. Those would need separate review before an investment decision.

I can also score DEN against peers such as DFW, ORD, ATL, or other Mountain West hubs if you'd like a relative ranking.
