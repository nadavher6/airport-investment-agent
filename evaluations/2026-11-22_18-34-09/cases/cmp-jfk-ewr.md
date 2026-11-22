# cmp-jfk-ewr

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
          "JFK",
          "EWR"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Compares international seat share for both"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** JFK vs EWR — which has the bigger long-haul business?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["JFK","EWR"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"JFK","name":"John F Kennedy International","score":74.6,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ AS…

**Agent answer:**

**JFK has the bigger long-haul business, both in share and in absolute volume.**

### Long-haul (international seat share)
- **JFK:** 52.9% of its seats were international (19,105,128 of 36,117,046 seats). That is above the 50% benchmark, so its long-haul sub-score is capped at 100.
- **EWR:** 32% of its seats were international (8,990,857 of 28,083,909 seats), which gives a sub-score of 64.
- In absolute terms, JFK flies more than twice as many international seats as EWR. This is the high-margin traffic that drives weight-based landing fees and gives an airport a customs/FIS facility moat.

### Caveats
- **"International" is a proxy for long-haul.** It includes short international routes such as Canada and the Caribbean, and it excludes long domestic routes like transcontinental flights.
- **The cap hides some of JFK's lead.** JFK's share is above 50%, so the sub-score of 100 understates how far ahead it is.
- **Data window:** BTS T-100, latest 12 months. Both airports have full data coverage.

I can also compare congestion, load factor (unmet demand), growth, or the overall investment score if that's useful. On those, EWR wins on growth and fuller planes.
