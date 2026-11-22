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
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"ORD","name":"Chicago O'Hare International","score":50,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)…

**Agent answer:**

**ORD is more congested** by the tool's measure.

| Metric (latest 12 months, BTS T-100) | ORD | DFW |
|---|---|---|
| Annual departures (congestion proxy) | **446,836** | 359,632 |
| Congestion sub-score (relative) | 100 | 0 |

O'Hare handled about **87,000 more departures** than DFW, roughly 24% more flights.

**How to read this**
- **Relative scoring:** With only two airports, the higher one gets 100 and the lower gets 0. The 100 vs. 0 shows which airport is busier, not how big the gap is. The raw departure counts show the actual difference.
- **Proxy limitation:** True congestion is operations divided by airfield capacity (Annual Service Volume, ASV). ASV isn't freely published, so the tool uses flight volume alone. DFW has a very large airfield with seven runways, which may handle its traffic with more slack. That would make ORD's capacity pressure even greater than these numbers suggest, but I can't confirm it with the available data.

**A related signal points the other way**
DFW's planes run fuller, with a load factor of **81.7% vs. 79.8%**. That isn't airfield congestion, but it suggests more passenger demand is being turned away at DFW. This matters if you care about capacity expansion rather than runway crowding.

**Overall investment score:** The two tie at 50 each.
- **ORD** wins on congestion and international seat share (16.6% vs. 15%).
- **DFW** wins on load factor and growth. Its passenger numbers grew 3.4% a year from 2019 to 2024, while ORD's fell 1.1% a year, and ORD is still only about 94% recovered to 2019 levels.

I can also score each airport against all U.S. airports to see where they stand nationally, rather than just against each other.
