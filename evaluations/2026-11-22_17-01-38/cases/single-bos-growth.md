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

# BOS (Boston Logan) Passenger Traffic Since 2019

**Boston Logan has fully recovered from the pandemic and now slightly exceeds its 2019 level, but it has barely grown beyond that.**

## Year-by-year enplanements

| Year | Enplanements | % of 2019 level | National rank |
|---|---|---|---|
| 2019 | 20,699,377 | 100.0% | 16 |
| 2020 | 6,035,452 | 29.2% | 19 |
| 2021 | 10,909,817 | 52.7% | 19 |
| 2022 | 17,443,775 | 84.3% | 16 |
| 2023 | 19,962,678 | 96.4% | 16 |
| 2024 | 21,090,721 | **101.9%** | 16 |

## Key takeaways

- **Recovery is complete.** 2024 traffic was about 1.9% above 2019, a gain of roughly 391,000 enplanements. The FAA recovery ratio is 1.0189.
- **Pandemic impact was severe.** In 2020, traffic fell about 71% from 2019, and BOS dropped from 16th to 19th nationally. It returned to 16th by 2022.
- **Growth is still positive.** 2024 was up 5.65% over 2023, so BOS is still adding passengers.
- **The longer-term growth rate has slowed sharply.**
  - The 5-year CAGR (2019 to 2024) is only **0.38% per year**, because the pandemic dip consumed most of that period.
  - Before the pandemic, BOS grew from 16.29M in 2015 to 20.70M in 2019, about **6.2% per year** (my calculation from the series).
  - The 2015 to 2024 rate is 2.91% per year. Note that this covers 9 periods, not a true 10 years.

## Investment context

BOS is a mature Large hub with demand back at record levels. A key question for investors is whether traffic returns to its pre-2019 growth rate or stays slower. Enplanement data alone doesn't show capacity constraints. Congestion, load factor and international share would give a fuller picture of expansion potential.

**Data limits:** This uses FAA calendar-year enplanements (2015 to 2024) only. It counts boarding passengers, not total passengers or flight operations, and it doesn't explain *why* traffic changed.

Would you like me to run an Investment Attractiveness Score for BOS, either on its own against all U.S. airports or compared with peers like JFK, EWR or PHL?
