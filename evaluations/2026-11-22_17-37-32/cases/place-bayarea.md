# place-bayarea

- **Group:** G5-place
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "find_airports_by_city",
      "inputContains": {
        "cities": [
          "Bay Area"
        ]
      }
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Resolves Bay Area to SFO/OAK/SJC",
    "Ranks them with real data"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank the Bay Area airports for investment.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Bay Area"]})`, `score_airports({"airport_codes":["SFO","SJC","OAK"]})`
  - find_airports_by_city → ok: {"results":{"Bay Area":{"matchedAs":"metro","airports":[{"code":"SFO","name":"San Francisco International","city":"San Francisco International Airport","state":"CA","hubType":"L","latestEnplanements":25078968,"secondary":false},{"code":"SJC","name":"Norman Y Mineta San Jose International","city":"San Jose","state":"CA","hubType":"M","latestEnplanements":5822019,"secondary":false},{"code":"OAK","na…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":100,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)…

**Agent answer:**

# Bay Area Airport Investment Ranking

The lookup tool found three main Bay Area airports. I scored them against each other, so 100 means best of these three, not best in the country.

| Rank | Airport | Score | Departures (12 mo) | Load factor | International seat share | 5-yr enplanement CAGR (2019→24) | Recovery vs 2019 |
|---|---|---|---|---|---|---|---|
| 1 | **SFO** – San Francisco Intl (Large hub) | **100** | 190,763 | 81.7% | 28.3% | −2.0% | 90.3% |
| 2 | **OAK** – Oakland (Medium hub) | **15** | 47,022 | 73.8% | 9.4% | −4.2% | 80.7% |
| 3 | **SJC** – San Jose (Medium hub) | **0.1** | 47,285 | 72.7% | 4.4% | −5.4% | 75.7% |

## Why SFO ranks first
SFO leads in all four scored categories:
- **Congestion (30% weight):** It has about 4× the departures of OAK or SJC, so its airfield is under the most strain.
- **Unmet demand (30%):** Planes are 81.7% full. That is near the 80–85% level where airlines start turning away passengers on peak days. This is the strongest sign that added capacity would be used.
- **Long-haul share (20%):** 28.3% of seats are international. Long-haul traffic brings in higher-margin revenue from landing fees, which are charged by aircraft weight, and customs facilities give SFO an advantage competitors can't easily copy.
- **Growth (20%):** SFO's traffic is still shrinking (−2.0% per year). It scores 100 only because it is shrinking the least of the three.

## OAK vs SJC
The two airports are similar in size. OAK finishes second because:
- its planes are a bit fuller (73.8% vs 72.7%)
- it has twice SJC's international share (9.4% vs 4.4%)
- it has lost less traffic (−4.2% vs −5.4% per year)

SJC's score of 0.1 doesn't mean it is worthless. It is simply last on almost every measure within this group.

## Takeaways for investment
- **SFO is the clear choice for capacity-adding investment.** Its full planes and heavy international traffic suggest demand would fill new capacity. Its traffic is still about 10% below 2019 levels, though, so a growth-based case rests on its strong position and full planes, not on rising volume.
- **OAK and SJC show little sign of strain.** Load factors around 73% and traffic down 19–24% from 2019 mean expansion there would likely sit underused for now. Upgrades aimed at efficiency or passenger experience would make more sense than adding capacity. OAK is the stronger of the two.

## Assumptions and data limits
- **The scores are relative.** They show order and spacing within these three airports only, and are rescaled so the best is 100 and the worst is 0. I can score any of them on their own to see how each compares with all U.S. airports.
- **Congestion is measured by departure volume, not true capacity use.** The proper measure (operations divided by annual service volume) isn't publicly available. Volume favors big airports, so this somewhat overstates SFO's lead.
- **Growth uses CY2019→CY2024 FAA enplanements,** so it reflects COVID recovery more than long-term trend.
- **The model leaves out costs and constraints,** such as construction costs, runway and land limits (SFO's are significant), airline agreements and financing. These would need separate review before making an investment decision.
