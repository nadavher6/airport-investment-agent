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
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":75.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

**SFO's unmet-demand sub-score is 81.7: its planes ran 81.7% full on average over the latest 12 months.**

### Why
- **Load factor:** BTS T-100 data shows 26,498,215 passengers on 32,451,463 seats, a load factor of 81.7%. This sub-score is simply that percentage (capped at 100), so it is an absolute measure and does not depend on any comparison set.
- **What it means:** An annual average above about 80–85% is where spill becomes material. On peak days and at peak hours, flights are likely selling out and turning passengers away. At 81.7%, SFO sits at the low end of that range. There are real signs of unserved demand, but it is not extreme.

### Caveats
- **Averages hide peaks.** This is a 12-month average across all routes, so specific peak periods or routes could be much fuller (or emptier) than 81.7% suggests.
- **Load factor is only a proxy.** It reflects airline seat-supply decisions as well as passenger demand. Airlines may hold capacity tight on purpose to protect fares, which raises load factor without signaling true excess demand.

I can also cover SFO's congestion, long-haul share or growth, or compare its unmet demand against other Bay Area airports (OAK, SJC), if that would be useful.
