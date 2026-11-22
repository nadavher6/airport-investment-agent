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

**No. LAX is nowhere near 200 million.** The FAA data shows about **37.8 million enplanements** in its latest year.

**What the data shows (FAA Passenger Boarding data)**
- **Latest year available:** CY2024, not 2025. The dataset covers CY2015 to CY2024, so I can't confirm anything for "last year" (2025).
- **2024 enplanements:** 37,760,834
- **National rank:** #5, down from #2 in 2023
- **Year-over-year change:** −7.8% (from 40,956,673 in 2023)
- **Recovery vs. 2019:** 0.88, about 88% of its pre-COVID level of 42,939,104
- **5-year CAGR (2019→2024):** −2.54%
- **2015→2024 growth rate:** +0.42% per year (a 9-period rate, not a true 10-year CAGR)

**Why figures for LAX can differ**
Enplanements count only passengers **boarding** at LAX. Airport "total passenger" figures usually count both arrivals and departures, which roughly doubles the number. On that basis LAX would be somewhere around 75 million, but that's an approximation and not in my data. Even so, it's far from 200 million. No U.S. airport handles that volume.

**Investment angle**
LAX is still very large, but its traffic is trending down. It fell in 2024 and remains about 12% below 2019. That matters if you're weighing it for capacity expansion. If useful, I can run the Investment Attractiveness Score for LAX on its own, or compare it against other airports such as SFO, SAN or the other LA-area airports. That score adds congestion, load factor and international share.
