# cmp-ord-dfw

- **Group:** G6-compare
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
          "ORD",
          "DFW"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Compares the congestion sub-score / departures for both",
    "States the answer clearly"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Which is more congested, ORD or DFW?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["ORD","DFW"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"ORD","name":"Chicago O'Hare International","score":60.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ AS…

**Agent answer:**

**ORD is the more congested airport.** It handled 446,836 departures over the latest 12 months, against 359,632 at DFW.

### Why
- **Higher traffic volume:** ORD runs about 87,000 more departures per year than DFW. A busier airfield faces more capacity pressure.
- **Relative score:** In this two-airport comparison, ORD gets the full congestion sub-score (100) and DFW gets 0. That doesn't mean DFW is uncongested. With min-max scoring, the busier of two airports is set to 100 and the other to 0.

### Caveat
Congestion here is measured by departure volume alone (BTS T-100, latest 12 months). A true congestion measure would divide operations by runway capacity (ASV), but that capacity figure isn't freely published. DFW has more runways than ORD, so the real gap in capacity pressure could differ from what departure counts suggest.

I can also compare their unmet demand (load factor), long-haul share, or growth, or give the full investment score, if useful.
