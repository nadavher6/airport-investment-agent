# place-la-sna

- **Group:** G5-place
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "find_airports_by_city",
      "optional": true
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Resolves LA→LAX and Santa Ana→SNA",
    "Compares congestion with real data"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare LA and Santa Ana airport congestion.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Los Angeles","Santa Ana"]})`, `score_airports({"airport_codes":["LAX","SNA"]})`
  - find_airports_by_city → ok: {"results":{"Los Angeles":{"matchedAs":"metro","airports":[{"code":"LAX","name":"Los Angeles International","city":"Los Angeles","state":"CA","hubType":"L","latestEnplanements":37760834,"secondary":false},{"code":"SNA","name":"John Wayne/Orange County","city":"Santa Ana","state":"CA","hubType":"M","latestEnplanements":5370273,"secondary":true},{"code":"ONT","name":"Ontario International","city":"O…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs. SNA: Congestion Comparison

**Bottom line:** By the available measures, LAX is much more congested. It runs about 5× as many departures as John Wayne/Orange County (SNA) and fills its planes slightly fuller. A key caveat is that the data measures traffic volume, not traffic relative to each airfield's capacity.

## Congestion indicators (BTS T-100, latest 12 months)

| Metric | LAX | SNA | LAX ÷ SNA |
|---|---|---|---|
| Annual departures | 266,820 | 51,447 | ~5.2× |
| Approx. departures per day | ~731 | ~141 | — |
| Seats offered | 43.85M | 6.94M | ~6.3× |
| Avg. seats per departure | ~164 | ~135 | — |
| Load factor (passengers ÷ seats) | **81.9%** | **79.3%** | +2.6 pts |
| Congestion sub-score (relative) | 100 | 0 | — |
| Unmet-demand sub-score (relative) | 100 | 0 | — |

## What this means

- **Airfield pressure:** LAX handles far more flights and uses larger aircraft on average. Its widebody and international operations make up 30.8% of seats, versus 2.1% at SNA. Both factors add pressure on gates, taxiways and terminals.
- **Spilled demand:** LAX's 81.9% load factor is in the range where peak-day demand starts getting turned away (roughly 80–85%+). SNA, at 79.3%, is just below that range. Neither number is extreme.
- **Trend:** The two airports are moving in opposite directions. LAX enplanements are still about 12% below 2019 (recovery ratio 0.88, −2.5%/yr CAGR 2019→2024). SNA has fully recovered (1.04×, +0.8%/yr). Pressure at SNA is rising, while LAX has not returned to its pre-COVID peak.

## Important limits

1. **Volume is not the same as congestion.** True congestion is operations divided by annual service volume (ASV), which captures runway and airspace capacity. ASV isn't freely published, so departures are used as a stand-in. An airport with modest traffic but tight physical or regulatory limits could be more constrained per flight than this data suggests. Whether that applies to SNA would need to be checked against airport capacity or master-plan documents. That information isn't in this dataset.
2. **The 0/100 scores are relative.** With only two airports compared, the busier one gets 100 and the other gets 0 on each factor. That shows which is higher, not how large the gap is. For a sense of how congested SNA is on its own terms, I can score it absolutely against all U.S. airports.
3. **Periods differ slightly.** Departures, seats and load factor cover the latest 12 months of BTS data. Enplanement growth uses calendar years 2019–2024.

Would you like me to run SNA (or LAX) on an absolute basis, or add the other LA-area airports (ONT, BUR, LGB) to see where regional overflow capacity sits?
