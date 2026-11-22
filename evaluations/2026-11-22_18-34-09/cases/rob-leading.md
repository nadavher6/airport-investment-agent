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

**No.** According to FAA data, LAX had **37,760,834 enplanements in CY2024**, the latest year available.

- **Enplanements count boardings only.** Total passengers, departing plus arriving, are roughly twice the boardings, which puts LAX at about 75 million. That is still far below 200 million.
- **2024 was a down year.** Boardings fell **7.8%** from 40,956,673 in 2023, and LAX dropped from #2 to **#5** nationally.
- **It has not fully recovered from COVID.** 2024 traffic was **87.9%** of the CY2019 level (42,939,104), and boardings shrank about **2.5% per year** from 2019 to 2024.

I can also score LAX's investment potential or compare it with other LA-area airports.
