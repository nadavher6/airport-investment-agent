# rank-fastest

- **Group:** G7-rank
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "get_enplanements",
      "optional": true
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Gives a ranked list with real growth figures",
    "Does NOT answer from general knowledge",
    "Produces a non-empty answer"
  ],
  "mustNot": [
    "Say figures are approximate/from memory",
    "Invent figures",
    "Return an empty answer"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Which large hub airports have grown the fastest since 2015?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_region({"region":"West Coast"})`, `find_airports_by_region({"region":"East Coast"})`, `find_airports_by_region({"region":"Midwest"})`, `find_airports_by_region({"region":"Southwest"})`, `find_airports_by_region({"region":"Southeast"})`, `find_airports_by_region({"region":"Mountain West"})`, `find_airports_by_region({"region":"Gulf Coast"})`, `find_airports_by_city({"cities":["Dallas","Austin","Honolulu","San Antonio","Pittsburgh","Sacramento","Anchorage"]})`, `get_enplanements({"airport_code":"AUS"})`, `get_enplanements({"airport_code":"BNA"})`
  - find_airports_by_region → ok: {"region":"West Coast","matchedAs":"region","cities":["Seattle","Portland","San Francisco Bay Area","Los Angeles","San Diego"],"results":{"Seattle":{"matchedAs":"metro","airports":[{"code":"SEA","name":"Seattle-Tacoma International","city":"Seattle","state":"WA","hubType":"L","latestEnplanements":25414592,"secondary":false}]},"Portland":{"matchedAs":"metro","airports":[{"code":"PDX","name":"Portla…
  - find_airports_by_region → ok: {"region":"East Coast","matchedAs":"region","cities":["Boston","Providence","New York","Philadelphia","Baltimore","Washington DC","Norfolk","Charleston","Savannah","Jacksonville","Orlando","Miami","West Palm Beach"],"results":{"Boston":{"matchedAs":"metro","airports":[{"code":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","latestEnplanements":…
  - find_airports_by_region → ok: {"region":"Midwest","matchedAs":"region","cities":["Chicago","Detroit","Minneapolis","St. Louis","Kansas City","Indianapolis","Cleveland","Cincinnati","Columbus","Milwaukee","Omaha","Des Moines","Madison","Grand Rapids"],"results":{"Chicago":{"matchedAs":"metro","airports":[{"code":"ORD","name":"Chicago O'Hare International","city":"Chicago","state":"IL","hubType":"L","latestEnplanements":38575693…
  - find_airports_by_region → ok: {"region":"Southwest","matchedAs":"region","cities":["Phoenix","Tucson","Albuquerque","Las Vegas","El Paso"],"results":{"Phoenix":{"matchedAs":"metro","airports":[{"code":"PHX","name":"Phoenix Sky Harbor International","city":"Phoenix","state":"AZ","hubType":"L","latestEnplanements":25595723,"secondary":false}]},"Tucson":{"matchedAs":"metro","airports":[{"code":"TUS","name":"Tucson International",…
  - find_airports_by_region → ok: {"region":"Southeast","matchedAs":"region","cities":["Atlanta","Charlotte","Raleigh-Durham","Nashville","Orlando","Tampa","Miami","Jacksonville","Charleston","Savannah","Birmingham","Memphis","Louisville","New Orleans","Fort Myers","West Palm Beach"],"results":{"Atlanta":{"matchedAs":"metro","airports":[{"code":"ATL","name":"Hartsfield/Jackson Atlanta International","city":"Atlanta","state":"GA","…
  - find_airports_by_region → ok: {"region":"Mountain West","matchedAs":"region","cities":["Denver","Salt Lake City","Boise","Las Vegas","Phoenix","Albuquerque","Billings","Bozeman","Colorado Springs"],"results":{"Denver":{"matchedAs":"metro","airports":[{"code":"DEN","name":"Denver International","city":"Denver","state":"CO","hubType":"L","latestEnplanements":40012895,"secondary":false}]},"Salt Lake City":{"matchedAs":"metro","ai…
  - find_airports_by_region → ok: {"region":"Gulf Coast","matchedAs":"region","cities":["Houston","New Orleans","Tampa","Fort Myers","Sarasota","Mobile","Pensacola","Corpus Christi","Gulfport-Biloxi"],"results":{"Houston":{"matchedAs":"metro","airports":[{"code":"IAH","name":"George Bush Intcntl/Houston","city":"Houston","state":"TX","hubType":"L","latestEnplanements":23349157,"secondary":false},{"code":"HOU","name":"William P Hob…
  - find_airports_by_city → ok: {"results":{"Dallas":{"matchedAs":"metro","airports":[{"code":"DFW","name":"Dallas-Fort Worth International","city":"Fort Worth","state":"TX","hubType":"L","latestEnplanements":42351316,"secondary":false},{"code":"DAL","name":"Dallas Love Field","city":"Dallas","state":"TX","hubType":"M","latestEnplanements":8654991,"secondary":false}]},"Austin":{"matchedAs":"metro","airports":[{"code":"AUS","name…
  - get_enplanements → ok: {"airportCode":"AUS","name":"Austin-Bergstrom International","city":"Austin","state":"TX","hubType":"L","series":[{"year":2015,"enplanements":5797562,"rank":34,"hubType":"M"},{"year":2016,"enplanements":6095545,"rank":35,"hubType":"M"},{"year":2017,"enplanements":6813171,"rank":34,"hubType":"M"},{"year":2018,"enplanements":7714479,"rank":33,"hubType":"M"},{"year":2019,"enplanements":8507410,"rank"…
  - get_enplanements → ok: {"airportCode":"BNA","name":"Nashville International","city":"Nashville","state":"TN","hubType":"L","series":[{"year":2015,"enplanements":5715205,"rank":35,"hubType":"M"},{"year":2016,"enplanements":6338517,"rank":33,"hubType":"M"},{"year":2017,"enplanements":6902771,"rank":33,"hubType":"M"},{"year":2018,"enplanements":8017347,"rank":31,"hubType":"M"},{"year":2019,"enplanements":8935654,"rank":31,…

**Agent answer:**

# Fastest-Growing Large Hubs Since 2015 (Partial Answer)

**I can't give a full ranking yet.** I identified 31 large hubs but hit the tool-call limit after pulling 2015–2024 growth data for only two of them: Nashville (BNA) and Austin (AUS). Both grew strongly, but I haven't checked the other 29, so I can't confirm these two are the fastest.

## The two airports I checked (FAA enplanement data, CY2015–CY2024)

| Metric | **BNA – Nashville** | **AUS – Austin** |
|---|---|---|
| 2015 enplanements | 5,715,205 | 5,797,562 |
| 2024 enplanements | 12,058,688 | 10,678,073 |
| Total growth, 2015→2024 | **about +111%** (more than doubled) | **about +84%** |
| Annual growth rate, 2015→2024* | **8.65%** | 7.02% |
| Annual growth rate, 2019→2024 | **6.18%** | 4.65% |
| 2024 traffic vs. 2019 | 1.35× | 1.26× |
| Change from 2023 to 2024 | **+7.4%** | −1.4% |
| National rank, 2015 → 2024 | #35 → #28 | #34 → #29 |
| Hub class change | Medium → Large in 2020 | Medium → Large in 2021 |

\*The tool's "10-year" rate covers 2015→2024, which is 9 years, so it is slightly higher than a true 10-year rate would be.

## What this suggests
- **Nashville looks the stronger of the two.** It grew faster over the whole period, faster since COVID, and was still growing in 2024.
- **Austin grew quickly through 2022, then levelled off.** Its 2024 traffic dipped 1.4% from 2023. That could mean growth is cooling, or that the airport is short of capacity. The data can't tell which. Austin is worth a closer look for expansion for that reason.
- Both airports moved up from medium-hub to large-hub status during this period.

## Large hubs I identified but did not check
SEA, SFO, LAX, SAN, BOS, JFK, EWR, LGA, PHL, BWI, IAD, DCA, MCO, MIA, FLL, TPA, ATL, CLT, ORD, MDW, DTW, MSP, PHX, LAS, DEN, SLC, IAH, DFW, HNL.

## Limits of this answer
- I found these airports through regional and city lookups, so a large hub outside those regions (for example, in Puerto Rico) could be missing.
- Enplanements count passengers boarding only. They don't show capacity, how full flights are, or financial results.

## Suggested next steps
1. Pull growth data for the remaining 29 large hubs to complete the ranking.
2. Run the investment score on the top growers to see whether their growth comes with congestion and unmet demand. That is a better signal of where expansion would pay off.
