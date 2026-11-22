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
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"JFK","name":"John F Kennedy International","score":50,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)…

**Agent answer:**

**JFK has the bigger long-haul business, by a wide margin.** It beats EWR on both the share and the absolute volume of international seats.

| Metric (BTS T-100, latest 12 months) | JFK | EWR |
|---|---|---|
| International seats | **19,105,128** | 8,990,857 |
| Total seats | 36,117,046 | 28,083,909 |
| International share of seats | **52.9%** | 32.0% |

- **Share:** More than half of JFK's seats are international, compared with about a third at EWR.
- **Volume:** JFK offers about 2.1× as many international seats as EWR (19.1M vs 9.0M).

**Why it matters for investment:** International traffic tends to carry higher margins. Airports earn weight-based landing fees from larger widebody aircraft, and customs/border (FIS) facilities are expensive and slow to build, which protects incumbents from competition. JFK's long-haul position is its main structural advantage over EWR.

**How to read the scores:**
- Because I compared only these two airports, the tool scores them relative to each other. The long-haul sub-scores (JFK 100, EWR 0) only show which airport is higher, not how strong either is nationally.
- On the overall Investment Attractiveness Score they tie at 50–50, because the factors offset:
  - JFK wins on congestion (212,209 vs 191,931 departures) and long-haul share.
  - EWR wins on unmet demand (84.0% vs 81.9% load factor) and growth (1.2% vs 0.3% per year, 2019–2024).
- So JFK is the stronger long-haul franchise, while EWR shows more signs of demand pressure and growth.

**Data limits:**
- "Long-haul" here means **international seats**, which is a proxy. It counts short international flights (Canada, Mexico, Caribbean) and leaves out long domestic routes such as transcontinental flights and Hawaii. The data has no distance-based breakdown, so the true widebody long-haul gap could differ from the 52.9% vs 32.0% split.
- The figures are seat capacity, not passengers or revenue.

If useful, I can score each airport on its own against all U.S. airports to see where their long-haul shares rank nationally.
