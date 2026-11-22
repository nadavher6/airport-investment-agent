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
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"ORD","name":"Chicago O'Hare International","score":65.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ AS…

**Agent answer:**

**No airport leads on both: DEN is the clear growth leader, JFK is the clear long-haul leader, and the two factors pull in opposite directions across this set.**

### Growth (enplanement CAGR, CY2019→CY2024)
- **DEN** is the only airport growing meaningfully, at 3.6% per year, so it sets the top of the scale (100).
- **JFK** is roughly flat at 0.3% per year, and **ATL** is slightly down at -0.4%.
- **ORD** shrank -1.1% per year.
- **LAX** is weakest at -2.5% per year, which puts it at the bottom of the scale (0). Its traffic is still below CY2019.

### Long-haul (international share of seats)
- **JFK** is the international gateway of the group. 52.9% of its seats are international, which is above the 50% benchmark, so its sub-score is capped at 100.
- **LAX** is a distant second at 30.8%.
- **ORD** (16.6%) and **ATL** (13.6%) are mostly domestic hubs with a sizable international layer.
- **DEN** is almost entirely domestic at 5.8%.

### Trade-offs
- **DEN:** the fastest-growing airport but the least international.
- **LAX:** the second-highest international share but the steepest decline.
- **JFK:** the best balance of the two, combining the top long-haul share with slightly positive growth.

### How to read this
- **Growth is relative:** it is scored min-max, so 100 means the best of these five, not of the US.
- **Long-haul is absolute:** it is the international share measured against a 50% benchmark.
- **Data windows and coverage:** growth uses FAA CY2019→CY2024 data, and long-haul uses BTS T-100 data for the latest 12 months. Coverage is complete for all five airports.

I can also compare congestion and unmet demand, or give the full investment score breakdown, if useful.
