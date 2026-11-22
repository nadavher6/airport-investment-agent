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

**LAX (Los Angeles International) had 37,760,834 enplanements in CY2024**, ranking #5 nationally as a Large hub. (KLAX is the 4-letter ICAO code; the FAA data uses the 3-letter code LAX.)

### Key trend points
- **Year over year:** down 7.8% from 40,956,673 in CY2023.
- **COVID recovery:** CY2024 traffic was about 88% of CY2019's 42,939,104, so LAX has **not fully recovered**.
- **Growth rates:** -2.5% per year from CY2019 to CY2024. From CY2015 to CY2024 it was +0.4% per year, measured over 9 periods.
- **Rank history:** #2 nationally in CY2015–2019 and again in CY2023, then #5 in CY2024.

Source: FAA Passenger Boarding (Enplanement) Data, CY2015–CY2024.

I can also score LAX's investment potential, covering congestion, load factor, international share and growth, or compare it with other LA-area airports such as BUR, SNA, LGB and ONT.
