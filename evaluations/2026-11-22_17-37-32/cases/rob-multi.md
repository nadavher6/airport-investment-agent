# rob-multi

- **Group:** G11-adversarial
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
    "Coherent table of all five with real growth + long-haul"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare JFK, LAX, ORD, ATL and DEN on growth and long-haul.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["JFK","LAX","ORD","ATL","DEN"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"ATL","name":"Hartsfield/Jackson Atlanta International","score":63.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":77.2,"contribution":23.2,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: …

**Agent answer:**

# Growth and Long-Haul: JFK, LAX, ORD, ATL, DEN

These scores are **relative**. On each metric, 100 is the best of these five airports and 0 is the worst, so the gaps look larger than they would against all U.S. airports.

## Growth (5-year enplanement CAGR, 2019→2024)

| Rank | Airport | CAGR | 2024 vs 2019 | 2024 enplanements | Sub-score |
|---|---|---|---|---|---|
| 1 | **DEN** | **+3.6%/yr** | 119% | 40.0M | 100 |
| 2 | JFK | +0.3%/yr | 101% | 31.5M | 46.1 |
| 3 | ATL | −0.4%/yr | 98% | 52.5M | 35.5 |
| 4 | ORD | −1.1%/yr | 94% | 38.6M | 22.8 |
| 5 | LAX | −2.5%/yr | 88% | 37.8M | 0 |

Denver is the only airport in the group with real growth. It is about 19% above its pre-COVID volume. LAX is still about 12% below 2019, and ORD is still about 6% below.

## Long-haul (international share of seats, latest 12 months)

| Rank | Airport | Intl share | Intl seats | Sub-score |
|---|---|---|---|---|
| 1 | **JFK** | **52.9%** | 19.1M | 100 |
| 2 | LAX | 30.8% | 13.5M | 53.1 |
| 3 | ORD | 16.6% | 8.8M | 22.9 |
| 4 | ATL | 13.6% | 8.4M | 16.6 |
| 5 | DEN | 5.8% | 2.9M | 0 |

JFK clearly leads, with more than half its seats international. DEN is mostly a domestic airport.

## On these two factors combined

Growth and long-haul each carry a 0.2 weight in the model. Adding their contributions gives:

1. **JFK: 29.2.** It is the only airport that does well on both: strong on long-haul and modestly positive on growth.
2. **DEN: 20.0.** It has the best growth but no international position.
3. **LAX: 10.6.** It has a solid international share but the weakest recovery.
4. **ATL: 10.4.** It is mid-to-low on both.
5. **ORD: 9.2.** It is low on both.

The two factors pull in opposite directions. DEN gives you **volume growth**, and JFK gives you **high-margin international traffic**. LAX's international share is worth something, but its shrinking passenger base is a warning sign for expansion.

## Full model score, for context

When congestion and load factor are included, the ranking changes: **ATL 63.6, JFK 55.5, DEN 49.6, LAX 43.9, ORD 39.1**. ATL leads because it has the highest load factor (82.2%) and heavy departure volume, not because of growth or long-haul.

## Caveats

- **International share only approximates long-haul.** It counts short international flights such as Canada, Mexico and the Caribbean. It leaves out long domestic routes like transcons, which affects JFK and LAX in particular.
- **The CAGR only compares the start and end years.** It shows the 2019→2024 net change and hides the path in between, including how fast each airport is recovering now.
- **Scores are relative to these five airports.** Adding or removing an airport would change every sub-score.

I can also score any of these on an absolute basis against all U.S. airports, or pull the 9-period (2015–2024) growth for a longer view.
