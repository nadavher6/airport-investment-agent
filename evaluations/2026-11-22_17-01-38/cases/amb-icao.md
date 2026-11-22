# amb-icao

- **Group:** G10-unknown
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Explains KLAX (ICAO) is not found / not supported",
    "Suggests LAX"
  ],
  "mustNot": [
    "Invent a KLAX figure"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** What are the enplanements for KLAX?

- **Classified as:** in_scope
- **Tools called:** `get_enplanements({"airport_code":"LAX"})`
  - get_enplanements → ok: {"airportCode":"LAX","name":"Los Angeles International","city":"Los Angeles","state":"CA","hubType":"L","series":[{"year":2015,"enplanements":36351272,"rank":2,"hubType":"L"},{"year":2016,"enplanements":39636042,"rank":2,"hubType":"L"},{"year":2017,"enplanements":41232432,"rank":2,"hubType":"L"},{"year":2018,"enplanements":42624050,"rank":2,"hubType":"L"},{"year":2019,"enplanements":42939104,"rank…

**Agent answer:**

**Los Angeles International (LAX)**. Note that "KLAX" is the 4-letter ICAO code. The FAA data is keyed by 3-letter codes, so I looked it up as **LAX**.

**Latest year (CY2024):** 37,760,834 enplanements
- National rank: **#5** (Large hub)
- Year-over-year change: **−7.8%** (down from 40,956,673 in 2023)

**Trend**
| Metric | Value |
|---|---|
| 5-yr CAGR (2019→2024) | −2.54% |
| "10-yr" CAGR (2015→2024, 9 periods) | +0.42% |
| Recovery vs. 2019 | 0.88 (about 88% of 2019 traffic) |

**Annual history**
| Year | Enplanements | Rank |
|---|---|---|
| 2015 | 36,351,272 | 2 |
| 2016 | 39,636,042 | 2 |
| 2017 | 41,232,432 | 2 |
| 2018 | 42,624,050 | 2 |
| 2019 | 42,939,104 | 2 |
| 2020 | 14,055,777 | 5 |
| 2021 | 23,663,410 | 5 |
| 2022 | 32,326,616 | 5 |
| 2023 | 40,956,673 | 2 |
| 2024 | 37,760,834 | 5 |

**What this means**
- LAX grew steadily to a peak of about 42.9M in 2019.
- It fell sharply during COVID and had nearly recovered by 2023.
- It then dropped again in 2024, so it is still only about 88% of its 2019 level.
- Over the full 2015–2024 span, growth is essentially flat.
- For investment purposes, this suggests that raw passenger growth is not currently LAX's strongest argument.
- Factors like congestion, international and long-haul share, and load factors may matter more.

**Data limits**
- This is FAA enplanement (boarding) data only. It doesn't explain *why* 2024 fell. Possible causes include airline capacity shifts, construction impacts, or traffic moving to nearby airports, but this data can't confirm any of them.

If you'd like, I can run the Investment Attractiveness Score for LAX, or compare it with other LA-area airports (BUR, LGB, SNA, ONT).
