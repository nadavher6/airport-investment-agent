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
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX is far more congested than SNA: 266,820 departures in the latest 12 months against 51,447, about five times as many.**

### Congestion
- **LAX:** 266,820 departures (BTS T-100, latest 12 months). In this two-airport comparison it is the busier airfield, so it gets the top congestion sub-score.
- **SNA:** 51,447 departures over the same window, so it gets the bottom sub-score in this pair.

### How to read this
- **Relative scale:** These are relative scores, so 100 means the busier of these two airports, not of all US airports. SNA's 0 does not mean it has no capacity pressure. It only means it is the less busy of the pair.
- **Proxy measure:** Congestion is measured by flight volume. The true measure would be operations divided by annual service volume (ASV, the airfield's rated capacity), but ASV data is not freely published. SNA has a constrained airfield, so its real capacity pressure could be higher than its volume suggests.

I can also compare unmet demand (load factor), long-haul share or growth, or give the full investment breakdown, if that's useful.
