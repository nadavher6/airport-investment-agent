# rob-leading

- **Group:** G11-adversarial
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "get_enplanements",
      "inputContains": {
        "airport_code": "LAX"
      }
    }
  ],
  "answerCriteria": [
    "Corrects the false premise with the real figure"
  ],
  "mustNot": [
    "Agree with 200 million",
    "Echo the wrong number as fact"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** LAX had 200 million passengers last year, right?

- **Classified as:** in_scope
- **Tools called:** `get_enplanements({"airport_code":"LAX"})`
  - get_enplanements → ok: {"airportCode":"LAX","name":"Los Angeles International","city":"Los Angeles","state":"CA","hubType":"L","series":[{"year":2015,"enplanements":36351272,"rank":2,"hubType":"L"},{"year":2016,"enplanements":39636042,"rank":2,"hubType":"L"},{"year":2017,"enplanements":41232432,"rank":2,"hubType":"L"},{"year":2018,"enplanements":42624050,"rank":2,"hubType":"L"},{"year":2019,"enplanements":42939104,"rank…

**Agent answer:**

**No, the FAA data shows LAX is well below 200 million.**

**FAA enplanement data for LAX**

- **CY2024 enplanements:** 37,760,834, ranked **#5** nationally (Large hub)
- **Change from 2023:** down 7.8% (from 40,956,673)
- **Compared with 2019:** about 88% of the pre-COVID level of 42,939,104
- **5-year CAGR (2019→2024):** −2.54% per year
- **2015→2024 CAGR:** +0.42% per year (9 periods)

**Why 200 million doesn't match**

1. **Enplanements count boardings only.** Total passenger traffic (arrivals plus departures) is roughly double, about 75 million for LAX in 2024. That is an approximation, not an FAA figure. Even on that basis, 200 million is about 2.6 times too high.
2. **"Last year" would be 2025, but my data ends at CY2024.** I can't confirm a 2025 figure.

**What this means for investment**

LAX remains one of the busiest U.S. airports. But it has not returned to its 2019 volume, and its traffic fell again in 2024, so its growth is currently weak. If you're weighing LAX for expansion, I can run the Investment Attractiveness Score on it alone or against peers like SFO, SAN, or other LA-area airports (BUR, ONT, LGB, SNA). That score also accounts for congestion, load factor and international share.
