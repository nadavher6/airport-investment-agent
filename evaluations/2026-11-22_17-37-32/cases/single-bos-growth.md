# single-bos-growth

- **Group:** G4-single
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "get_enplanements",
      "inputContains": {
        "airport_code": "BOS"
      }
    }
  ],
  "answerCriteria": [
    "Cites BOS enplanements and the 2019→latest change or CAGR",
    "Says it's official FAA data"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** How has BOS passenger traffic changed since 2019?

- **Classified as:** in_scope
- **Tools called:** `get_enplanements({"airport_code":"BOS"})`
  - get_enplanements → ok: {"airportCode":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","series":[{"year":2015,"enplanements":16290362,"rank":17,"hubType":"L"},{"year":2016,"enplanements":17759044,"rank":17,"hubType":"L"},{"year":2017,"enplanements":18759742,"rank":16,"hubType":"L"},{"year":2018,"enplanements":20006521,"rank":16,"hubType":"L"},{"year":2019,"enplanement…

**Agent answer:**

# BOS Passenger Traffic Since 2019

Boston Logan has **fully recovered and slightly surpassed** its pre-pandemic peak, but net growth since 2019 is small.

## The numbers (FAA enplanements)

| Year | Enplanements | % of 2019 | National rank |
|---|---|---|---|
| 2019 | 20,699,377 | 100.0% | 16 |
| 2020 | 6,035,452 | 29.2% | 19 |
| 2021 | 10,909,817 | 52.7% | 19 |
| 2022 | 17,443,775 | 84.3% | 16 |
| 2023 | 19,962,678 | 96.4% | 16 |
| **2024** | **21,090,721** | **101.9%** | **16** |

## What changed

- **COVID collapse:** Traffic fell about 71% in 2020, and BOS dropped from 16th to 19th nationally.
- **Steady rebound:** Recovery took four years. BOS regained its #16 rank in 2022 and passed its 2019 volume in 2024.
- **Net gain since 2019:** About 391,000 more enplanements, or +1.9% (FAA recovery ratio of 1.019).
- **Latest momentum:** 2024 was up 5.7% over 2023.
- **5-year CAGR (2019→2024):** only 0.38% per year, because the pandemic wiped out several years of growth.

## Context for investment analysis

- **Pre-COVID growth was much faster.** From 2015 to 2019, BOS grew from 16.3M to 20.7M enplanements, about 6.2% per year (my calculation from the series above). The 2015→2024 rate is 2.9% per year (FAA's "10-year" figure, which actually covers 9 periods).
- **The key question is whether BOS returns to its pre-2019 growth path.** The 5.7% gain in 2024 suggests momentum is still healthy now that recovery is complete. That would point to growing capacity pressure. A flat path would point the other way.

## Data limits

- These are boardings only, not total passengers (arrivals plus departures), flights, or seats.
- The data runs through CY2024, so 2025 and later are not covered.
- Enplanements alone don't show congestion or unmet demand.

If you'd like, I can run the Investment Attractiveness Score for BOS, which adds congestion, load factor, and international share. I can also compare it against peers such as JFK, EWR, or PHL.
