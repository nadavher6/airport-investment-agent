# amb-icao

- **Group:** G10-unknown
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Explains KLAX (ICAO) is not the keyed code / maps to LAX",
    "Uses real LAX data"
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

**Los Angeles International (LAX)** passenger enplanements, from FAA Passenger Boarding Data. "KLAX" is the 4-letter ICAO code, which the FAA dataset doesn't use, so I looked it up as **LAX**.

**Latest year (CY2024)**
- **Enplanements:** 37,760,834
- **National rank:** #5 (Large hub)
- **Year-over-year:** −7.8%, down from 40,956,673 in 2023

**Trend**
- **5-year CAGR (2019→2024):** −2.54% per year
- **9-period CAGR (2015→2024):** +0.42% per year
- **Recovery vs. 2019:** 0.88, so 2024 traffic was about 88% of the pre-pandemic level (42,939,104 in 2019)

**History**

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

**What this means for investment**
- LAX grew steadily through 2019 and recovered strongly through 2023, reaching about 95% of its 2019 level.
- In 2024 it fell again and dropped from #2 to #5 nationally. It is still below its pre-pandemic peak, so passenger growth alone doesn't make a strong case for adding capacity right now.
- This data doesn't explain why 2024 fell, and I won't guess.
- Enplanements cover only one part of the picture. A full assessment would also look at congestion, load factors and international share.

If you'd like, I can run the Investment Attractiveness Score on LAX alone (compared with all U.S. airports) or against peers like SFO, SAN or other LA-area airports.
