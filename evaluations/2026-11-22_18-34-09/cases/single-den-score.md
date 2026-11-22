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
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"DEN","name":"Denver International","score":70.7,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","inp…

**Agent answer:**

**Denver International (DEN) scores 70.7 out of 100, scored absolutely against all U.S. airports.**

### Why it scores this way
- **Congestion (+30, the maximum):** DEN handled 345,892 departures over the latest 12 months. That makes it one of the busiest airfields in the country and puts it at the top of this category. This uses traffic volume as a stand-in for capacity pressure, because runway capacity (ASV) data isn't freely published.
- **Unmet demand (+24.2):** Planes ran 80.8% full. That is at the low end of the roughly 80–85% range where airlines start turning away passengers on peak days. There is real spill, but it is not yet severe.
- **Growth (+14.2):** Passengers grew about 3.6% per year from CY2019 to CY2024. That is a solid recovery and expansion record for a large hub.
- **Long-haul (+2.3, the weak spot):** Only 5.8% of seats are international, measured against a 50% benchmark. DEN is mostly a domestic connecting hub, so it gets little of the high-margin international revenue, such as customs (FIS) facilities and weight-based fees.

### Bottom line
DEN's case for investment rests on volume and growth. A busy, growing airfield with fairly full planes supports investment in capacity, such as gates, terminal space and airfield throughput. The low international share caps the score. Adding more long-haul international service would be the biggest lever for raising it.

### How to read this
- **Mode:** absolute, comparing DEN with all U.S. airports.
- **Coverage:** complete, with all four categories available and nothing missing.
- **Data windows:** FAA CY2024 enplanements (40,012,895) and CY2019→CY2024 growth; BTS T-100 data for the latest 12 months.

I can also compare DEN head-to-head with peer hubs such as DFW, ORD or ATL if that would help.
