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
- **Tools called:** `find_airports_by_city({"cities":["Dallas","Houston","Austin","San Antonio","El Paso","Lubbock","Midland","McAllen","Corpus Christi","Harlingen…)`, `score_airports({"airport_codes":["DFW","DAL","IAH","HOU","AUS","SAT","ELP","LBB","MAF","MFE","CRP","HRL","BRO","AMA","LRD","ACT","GRK",…)`
  - find_airports_by_city → ok: {"results":{"Dallas":{"matchedAs":"metro","airports":[{"code":"DFW","name":"Dallas-Fort Worth International","city":"Fort Worth","state":"TX","hubType":"L","latestEnplanements":42351316,"secondary":false},{"code":"DAL","name":"Dallas Love Field","city":"Dallas","state":"TX","hubType":"M","latestEnplanements":8654991,"secondary":false}]},"Houston":{"matchedAs":"metro","airports":[{"code":"IAH","nam…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"DFW","name":"Dallas-Fort Worth International","score":90.2,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷…

**Agent answer:**

# Fastest-Growing Texas Airports (2019→2024)

I ranked by **5-year passenger (enplanement) CAGR, 2019→2024**, from the FAA data returned by the scoring tool. I covered 24 commercial airports in 22 Texas cities.

## Growth ranking

| Rank | Airport | 2024 Enplanements | 5-yr CAGR | 2024 vs 2019 |
|---|---|---|---|---|
| 1 | **LRD** Laredo | 172,726 | **+13.7%** | 1.90× |
| 2 | **HRL** Harlingen (Valley Intl) | 603,561 | **+12.5%** | 1.80× |
| 3 | **MFE** McAllen | 625,670 | **+8.2%** | 1.48× |
| 4 | **BRO** Brownsville | 188,157 | **+7.8%** | 1.45× |
| 5 | GGG Longview | 35,057 | +5.2% | 1.29× |
| 6 | **AUS** Austin | 10,678,073 | **+4.7%** | 1.26× |
| 7 | ELP El Paso | 2,071,894 | +3.5% | 1.19× |
| 8 | **DFW** Dallas-Fort Worth | 42,351,316 | +3.4% | 1.18× |
| 9 | BPT Beaumont | 33,907 | +3.1% | 1.17× |
| 10 | ABI Abilene | 94,579 | +2.9% | 1.16× |
| 11 | AMA Amarillo | 402,315 | +2.6% | 1.14× |
| 12 | MAF Midland | 761,865 | +2.5% | 1.13× |
| 13 | CRP Corpus Christi | 369,393 | +2.4% | 1.13× |
| 14 | SAT San Antonio | 5,466,684 | +1.7% | 1.09× |
| 15 | LBB Lubbock | 563,180 | +1.6% | 1.08× |
| 16 | DAL Dallas Love | 8,654,991 | +1.4% | 1.07× |
| 17 | IAH Houston Bush | 23,349,157 | +1.3% | 1.07× |
| 18 | HOU Houston Hobby | 7,116,967 | +0.1% | 1.01× |

These six airports shrank over the period: TYR (−3.0%), ACT (−3.1%), CLL (−4.0%), SJT (−5.7%), SPS (−6.0%) and GRK Killeen (−7.8%).

## Key takeaways

**1. The Rio Grande Valley and border airports lead on percentage growth.** LRD, HRL, MFE and BRO are the four fastest-growing airports in the state. Most of them started from small bases, though.

**2. Absolute growth is a different picture.** These figures are my own estimates, derived as 2024 enplanements ÷ the 2024/2019 ratio:
- DFW: about +6.6 million passengers
- AUS: about +2.2 million
- ELP: about +330,000
- HRL: about +270,000
- MFE: about +200,000
- LRD: about +80,000

DFW alone added more passengers than all the Valley airports combined.

**3. Growth does not always mean the airport is short of capacity.**
- **HRL** is a good example. It grew 12.5% a year, but planes were only **63.9% full**. Airlines appear to have added seats faster than demand, so there is little spilled demand to capture.
- **MFE** shows the opposite. It grew 8.2% a year and planes were **82.4% full**. That is the strongest sign of turned-away demand among the fast growers.
- **AUS** is the standout among large hubs. It grew 4.7% a year with a 76.3% load factor.

**4. The overall investment score leans toward the big hubs.** On the blended Investment Attractiveness Score (relative to this Texas set), the top five are:
- DFW: 90.2
- IAH: 84.7
- AUS: 52.0
- MFE: 48.2
- SAT: 45.2

The score weights congestion, load factor and international share alongside growth, which favors the large hubs. For a profitable expansion case, **AUS and MFE** combine growth with real demand pressure. **LRD and HRL** are fast-growing but small or under-filled.

## Caveats
- **Coverage:** The tools can't search by state, so I built the airport list from Texas cities myself. Smaller commercial airports in cities I didn't include may be missing.
- **Time period:** CAGR covers 2019→2024 and includes the COVID drop and recovery. A small airport adding or losing one airline can swing its rate a lot.
- **Year labels:** The scoring tool calls the period "FY2019→FY2024," but its underlying enplanement source is described as calendar-year data. Treat it as the 2019–2024 period.
- **Load factor:** Load factor and departures come from BTS T-100 data for the latest 12 months, which is a different time window from the growth figures.

I can also pull year-over-year 2024 change for the top growers to check whether their momentum is continuing.
