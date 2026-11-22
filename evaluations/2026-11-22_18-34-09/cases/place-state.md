# place-state

- **Group:** G5-place
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Handles that states aren't a supported region OR resolves Texas metros",
    "Does not fabricate a Texas airport list"
  ],
  "mustNot": [
    "Invent airports"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Which airports in Texas are growing fastest?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Dallas","Houston","Austin","San Antonio","El Paso"]})`, `score_airports({"airport_codes":["DFW","IAH","AUS","DAL","HOU"]})`
  - find_airports_by_city → ok: {"results":{"Dallas":{"matchedAs":"metro","airports":[{"code":"DFW","name":"Dallas-Fort Worth International","city":"Fort Worth","state":"TX","hubType":"L","latestEnplanements":42351316,"secondary":false},{"code":"DAL","name":"Dallas Love Field","city":"Dallas","state":"TX","hubType":"M","latestEnplanements":8654991,"secondary":false}]},"Houston":{"matchedAs":"metro","airports":[{"code":"IAH","nam…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"DFW","name":"Dallas-Fort Worth International","score":75.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷…

**Agent answer:**

**Austin (AUS) is the fastest-growing of the five large Texas airports scored, at 4.7% per year from CY2019 to CY2024.** DFW is a clear second.

### Growth, CY2019→CY2024 (FAA enplanement CAGR)
- **AUS: 4.7% per year.** This is the fastest of the five, so it gets the full growth sub-score in this comparison.
- **DFW: 3.4% per year.** This is strong growth for the largest airport in the group (42.4M enplanements in CY2024).
- **DAL: 1.4% per year** and **IAH: 1.3% per year.** Both are growing modestly and are close to each other.
- **HOU: 0.1% per year.** Traffic is essentially flat versus CY2019, so HOU is the lowest of the set.

The pattern is that Austin and DFW pull well ahead, while both Houston airports and Love Field have grown only slightly since before COVID.

### Caveats
- **Not every Texas airport was compared.** The scoring tool takes at most 5 airports, so **San Antonio (SAT)** and **El Paso (ELP)** were found but not scored. I also only searched the five largest metros, so smaller airports such as Midland, Lubbock and Corpus Christi aren't included.
- A five-year CAGR measures the 2019 to 2024 change as a whole. It does not show whether growth is speeding up or slowing down.

I can pull growth figures for SAT, ELP or other Texas airports to complete the list. I can also compare these airports on congestion, load factor or long-haul share, or give the full investment ranking, if that's useful.
