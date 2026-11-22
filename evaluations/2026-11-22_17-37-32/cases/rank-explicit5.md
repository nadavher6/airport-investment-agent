# rank-explicit5

- **Group:** G7-rank
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
    "Ranks all five with real sub-scores",
    "Explains the top pick"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank JFK, LAX, ORD, ATL, and DEN for investment.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["JFK","LAX","ORD","ATL","DEN"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"ATL","name":"Hartsfield/Jackson Atlanta International","score":63.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":77.2,"contribution":23.2,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: …

**Agent answer:**

# Investment Ranking: JFK, LAX, ORD, ATL, DEN

These scores are **relative to these five airports only**. 100 means best of this group, not best in the U.S.

| Rank | Airport | Score | Congestion (30%) | Unmet demand (30%) | Long-haul (20%) | Growth (20%) |
|---|---|---|---|---|---|---|
| 1 | **ATL** – Atlanta | **63.6** | 77.2 | 100 | 16.6 | 35.5 |
| 2 | **JFK** – New York | **55.5** | 0 | 87.5 | 100 | 46.1 |
| 3 | **DEN** – Denver | **49.6** | 57.0 | 41.7 | 0 | 100 |
| 4 | **LAX** – Los Angeles | **43.9** | 23.3 | 87.5 | 53.1 | 0 |
| 5 | **ORD** – Chicago O'Hare | **39.1** | 100 | 0 | 22.9 | 22.8 |

*(Sub-scores are 0–100 within this group.)*

## What drives each result

**1. ATL (63.6): best all-round demand pressure**
- It has the highest load factor in the group at **82.2%** (51.0M passengers on 62.1M seats).
- It is the second-busiest airfield with **393,351 departures**.
- Weaknesses: only **13.6%** of seats are international, and enplanements are flat at **−0.4%/yr** (2019→2024), with recovery at 98% of 2019.

**2. JFK (55.5): the international premium play**
- **52.9%** of seats are international, by far the highest here. That is high-margin traffic.
- Planes are full, with an **81.9%** load factor.
- It scores 0 on congestion only because it has the fewest departures (**212,209**). That partly reflects wide-body flying, so the volume-based proxy understates its capacity pressure.

**3. DEN (49.6): the growth story**
- It is the only strong grower: **+3.6%/yr** since 2019 and **119%** of its 2019 traffic.
- Weaknesses: the lowest international share (**5.8%**) and a middling load factor (**80.8%**).
- Durable growth is arguably the best signal for long-term expansion returns.

**4. LAX (43.9): solid demand, shrinking traffic**
- It has a good load factor (**81.9%**) and a strong international share (**30.8%**).
- But it has the weakest growth: **−2.5%/yr**, with only **88%** of 2019 traffic recovered.

**5. ORD (39.1): busiest, but planes have the most room**
- It has the most departures (**446,836**), so it maxes the congestion score.
- But it has the lowest load factor (**79.8%**), suggesting airlines aren't spilling much demand.
- Growth is negative at **−1.1%/yr**.

## Caveats

- **Relative scaling exaggerates small gaps.** Load factors span only 79.8%–82.2%, yet that maps to sub-scores of 0–100. ATL's lead over JFK and LAX on unmet demand is real but modest in absolute terms. Scoring an airport alone gives an absolute view against all U.S. airports.
- **The congestion score is a proxy.** It uses departure volume, not operations divided by runway capacity (ASV, which isn't freely published). It undervalues slot-constrained, wide-body-heavy airports like JFK and LAX.
- **The weights are a model choice** (30/30/20/20). If you prioritize growth durability, DEN would likely move up. If you prioritize international yield, JFK would likely take first.
- **Cost and constraints are not covered.** The score excludes construction costs, land availability, airline lease and use agreements, regulatory constraints, and projects already underway. All of these heavily affect actual project profitability.

**Bottom line:** ATL leads on demand pressure, JFK on high-margin international traffic, and DEN on growth momentum. LAX and ORD rank lower mainly because of shrinking traffic, and in ORD's case, the lowest load factor.
