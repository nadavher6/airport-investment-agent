# rank-southwest

- **Group:** G7-rank
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "find_airports_by_region",
      "inputContains": {
        "region": "Southwest"
      }
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Resolves the Southwest region, then ranks with real data"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Best airports for terminal expansion in the Southwest?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_region({"region":"Southwest"})`, `score_airports({"airport_codes":["PHX","LAS","ABQ","ELP","TUS"]})`
  - find_airports_by_region → ok: {"region":"Southwest","matchedAs":"region","cities":["Phoenix","Tucson","Albuquerque","Las Vegas","El Paso"],"results":{"Phoenix":{"matchedAs":"metro","airports":[{"code":"PHX","name":"Phoenix Sky Harbor International","city":"Phoenix","state":"AZ","hubType":"L","latestEnplanements":25595723,"secondary":false}]},"Tucson":{"matchedAs":"metro","airports":[{"code":"TUS","name":"Tucson International",…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"PHX","name":"Phoenix Sky Harbor International","score":93.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations …

**Agent answer:**

# Best Southwest Airports for Terminal Expansion

**Bottom line:** Phoenix Sky Harbor (PHX) and Harry Reid in Las Vegas (LAS) are the clear leaders. They score far above the other three airports in the region.

## Ranking

The scores below are relative. A score of 100 would mean best of these five airports on every measure. They are not compared against all U.S. airports.

| Rank | Airport | Score | 2024 Enplanements | Departures (12 mo) | Load Factor | Intl Seat Share | 5-yr CAGR |
|---|---|---|---|---|---|---|---|
| 1 | **PHX** Phoenix Sky Harbor | **93.1** | 25.6M | 221,624 | 79.1% | 5.4% | 2.7% |
| 2 | **LAS** Harry Reid (Las Vegas) | **90.2** | 28.2M | 198,194 | 78.8% | 5.9% | 2.7% |
| 3 | ELP El Paso | 25.5 | 2.1M | 21,712 | 71.9% | 1.6% | 3.5% |
| 4 | TUS Tucson | 23.9 | 2.0M | 20,933 | 76.4% | ~0% | 1.2% |
| 5 | ABQ Albuquerque | 8.4 | 2.7M | 29,907 | 73.6% | ~0% | 0.4% |

## Why PHX and LAS lead

**Phoenix (PHX)** ranks first in the set for two reasons:
- **Busiest airfield:** about 221.6K departures.
- **Fullest planes:** a 79.1% load factor.

It is also fully past its pre-COVID level, at 114% of its 2019 passengers. Terminal investment here would serve demand that already exists, rather than demand that is only forecast.

**Las Vegas (LAS)** is essentially tied with Phoenix:
- It has the **most passengers** (28.2M).
- It has the **highest international share** (5.9%). International traffic matters for revenue because it brings customs-facility fees and higher-yield long-haul flights.

LAS trails PHX mainly on departures (198K vs. 222K). It also recovered strongly, at 114% of its 2019 level.

## The smaller three

- **El Paso (ELP)** is the fastest-growing airport in the group, at 3.5% per year and 119% of 2019. However, its planes are only 71.9% full. That suggests airlines could add flights to the existing terminal before new capacity is needed. It is worth watching rather than an immediate expansion case.
- **Tucson (TUS)** fills its planes moderately well (76.4%). Its growth is slow and it has virtually no international service.
- **Albuquerque (ABQ)** shows the weakest case. Growth is nearly flat (0.4% per year), it is barely above 2019 levels (102%), and its load factor is soft.

## Caveats to keep in mind

1. **Even the leaders aren't at the strain threshold yet.** The scoring model treats load factors above roughly 80–85% as the point where significant demand is being turned away. PHX and LAS are just under 80%. Their case rests more on sheer volume and steady growth than on acute overcrowding.
2. **The congestion measure reflects airfield traffic, not terminal crowding.** It uses departure counts because true capacity data isn't freely published. Terminal expansion depends on gate use, peak-hour passenger flows, and how full the security checkpoints and concourses are. None of that is in this data, so a site-level capacity study would be needed.
3. **This is a demand screen, not a profitability model.** It doesn't account for construction cost, existing expansion plans, airline agreements, or how projects would be funded.
4. **The region definition is narrow.** The lookup tool's "Southwest" covers only Phoenix, Tucson, Albuquerque, Las Vegas and El Paso. If you consider Texas metros like Dallas, Houston, Austin or San Antonio to be part of the Southwest, I can score them alongside PHX and LAS.

Would you like me to score PHX and LAS against all U.S. airports, or add the Texas metros to the comparison?
