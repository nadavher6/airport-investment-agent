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

**BOS passenger traffic is slightly above its 2019 level: 21,090,721 enplanements in CY2024 against 20,699,377 in CY2019. That is a recovery ratio of 1.0189, or about 1.9% above pre-COVID.**

### The path since 2019
- **2020 collapse:** Enplanements fell to 6,035,452, about 29% of the 2019 level. National rank slipped from 16 to 19.
- **Rebuild:** Traffic reached 10,909,817 in 2021, 17,443,775 in 2022 and 19,962,678 in 2023. BOS was back at rank 16 by 2022.
- **2024:** Up 5.65% year over year, passing 2019 for the first time.

### Growth rate
- **CY2019→CY2024:** 0.38% per year compounded. That is close to flat, because the gain was all recovery.
- **CY2015→CY2024:** 2.91% per year. This rate covers 9 periods, so it is not a true 10-year rate. BOS was growing steadily before COVID, from 16.3M in 2015 to 20.7M in 2019.

### Caveat
These figures count FAA passenger boardings (enplanements) only. They don't show load factors, flight operations or the international mix.

I can score BOS's full investment potential, including congestion, unmet demand and long-haul share, or compare it with other airports if that's useful.
