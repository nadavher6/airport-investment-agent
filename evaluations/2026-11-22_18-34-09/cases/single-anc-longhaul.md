# single-anc-longhaul

- **Group:** G4-single
- **Turns:** 1

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
          "ANC"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Gives the international seat share with its basis (BTS T-100)"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** What is the long-haul / international share out of Anchorage?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Anchorage"]})`, `score_airports({"airport_codes":["ANC"]})`
  - find_airports_by_city → ok: {"results":{"Anchorage":{"matchedAs":"metro","airports":[{"code":"ANC","name":"Ted Stevens Anchorage International","city":"Anchorage","state":"AK","hubType":"M","latestEnplanements":2767856,"secondary":false}]}}}
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"ANC","name":"Ted Stevens Anchorage International","score":59.5,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":86,"contribution":25.8,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operati…

**Agent answer:**

**About 1% of ANC's seats are international: 36,472 out of 3,817,316 seats in the latest 12 months (BTS T-100).**

- **Long-haul sub-score: 2 out of 100.** The score compares the share against a 50% benchmark, where 50% international equals 100. ANC scores near the bottom on this factor.
- **What it means:** almost all of ANC's passenger traffic is domestic. That includes flights to the Lower 48 and within Alaska. It earns little of the high-margin international revenue, such as weight-based fees and the advantage of having customs (FIS) facilities.

**Caveats**
- This measures **passenger seats only**. ANC is known as a cargo hub, and freight is not part of this figure. A low international passenger share does not reflect its cargo role.
- "International" here means seats on international flights, which is a proxy for long-haul. It does not measure flight distance.

I can also cover ANC's congestion, load factor (unmet demand) or growth, or compare its international share with other airports, if that's useful.
