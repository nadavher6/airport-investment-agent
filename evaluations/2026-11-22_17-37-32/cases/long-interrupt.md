# long-interrupt

- **Group:** G12-long
- **Turns:** 5

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Handles the off-topic turn, then resumes with the prior airports intact",
    "Adds SAN to the ranking",
    "Final summary consistent with earlier turns"
  ],
  "mustNot": [
    "Lose the Bay Area context after the interruption",
    "Answer the weather"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank the Bay Area airports.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Bay Area"]})`, `score_airports({"airport_codes":["SFO","SJC","OAK"]})`
  - find_airports_by_city → ok: {"results":{"Bay Area":{"matchedAs":"metro","airports":[{"code":"SFO","name":"San Francisco International","city":"San Francisco International Airport","state":"CA","hubType":"L","latestEnplanements":25078968,"secondary":false},{"code":"SJC","name":"Norman Y Mineta San Jose International","city":"San Jose","state":"CA","hubType":"M","latestEnplanements":5822019,"secondary":false},{"code":"OAK","na…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":100,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)…

**Agent answer:**

# Bay Area Airport Investment Ranking

| Rank | Airport | Score (relative) | 2024 Enplanements | Hub |
|---|---|---|---|---|
| 1 | **SFO**, San Francisco Intl | **100** | 25,078,968 | Large |
| 2 | **OAK**, Oakland | **15** | 5,292,736 | Medium |
| 3 | **SJC**, San Jose | **0.1** | 5,822,019 | Medium |

**These scores only compare the three airports with each other.** 100 means best of this group and 0 means weakest. A score of 0.1 for SJC does not mean it is a bad investment in absolute terms. It means SJC trails the other two on almost every measure.

## Why SFO leads on every factor

| Factor (weight) | SFO | OAK | SJC |
|---|---|---|---|
| Congestion: departures (30%) | 190,763 | 47,022 | 47,285 |
| Unmet demand: load factor (30%) | **81.7%** | 73.8% | 72.7% |
| Long-haul: international seat share (20%) | **28.3%** | 9.4% | 4.4% |
| Growth: 5-yr enplanement CAGR, 2019→24 (20%) | −2.0% | −4.2% | −5.4% |
| Recovery vs. 2019 | 90% | 81% | 76% |

- **SFO** has about 4 times the departures of either peer. Its planes run nearly 82% full, which is the range where airlines start turning away peak-day demand. More than a quarter of its seats are international, and that traffic earns higher margins. Of the three airports, SFO has the strongest case for adding capacity.
- **OAK** edges out SJC because its planes are slightly fuller, its international share is about double SJC's, and its traffic has declined less. On congestion the two are effectively tied.
- **SJC** handles more passengers than OAK. However, it has the lowest load factor, the smallest international share, and the steepest traffic decline, recovering only about 76% of its 2019 passengers.

## Caveats
1. **No airport in the Bay Area has grown since 2019.** SFO gets the full 100 on growth only because it shrank the least. The whole region is still below 2019 passenger levels, so expansion here relies on demand returning, not on current growth.
2. **Congestion is measured by departure volume, not true capacity use.** The real measure would be operations divided by annual service volume (ASV), but that capacity figure isn't publicly available. A large, busy airport can still have runway headroom. SFO's runways are closely spaced and limit operations in bad weather, but that constraint isn't captured in this data.
3. **Load factor shows average demand, not peak demand.** Peak-hour spill could be higher than the 81.7% average suggests.
4. **The score does not include costs or feasibility.** It ignores construction cost, land, and Bay fill limits at SFO and OAK, as well as airline lease terms and the cost per enplanement already charged. A cheaper project at OAK or SJC could still earn a better return even with a lower attractiveness score.
5. The search found only the three main Bay Area airports. Smaller fields such as STS (Santa Rosa) were not included.

**Next step:** I can score each airport on its own against all U.S. airports. That would show whether SFO is attractive nationally, not just within the Bay Area, and whether OAK or SJC are as weak as this comparison makes them look.

### Turn 2
**User:** Why is SFO ahead of OAK?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

# Why SFO Scores Ahead of OAK

SFO leads OAK on **all four factors**, so OAK has nothing to offset the gap. Here are the figures from the earlier scoring run:

| Factor (weight) | SFO | OAK | Gap |
|---|---|---|---|
| Congestion: departures (30%) | 190,763 | 47,022 | SFO has about 4.1× as many |
| Unmet demand: load factor (30%) | 81.7% | 73.8% | +7.9 pts for SFO |
| Long-haul: international seat share (20%) | 28.3% | 9.4% | SFO is about 3× higher |
| Growth: 5-yr CAGR, 2019→24 (20%) | −2.0% | −4.2% | SFO shrank 2.2 pts/yr less |

## What each gap means

1. **Congestion (biggest driver).** SFO runs about four times as many departures. OAK actually has slightly *fewer* departures than SJC (47,022 vs. 47,285), so it sits at the bottom of the group on this 30%-weighted factor.
2. **Unmet demand.** SFO's planes average about 82% full, compared with about 74% at OAK. A fuller airport suggests airlines would add flights if there were room. OAK's planes still have spare seats, which means more capacity there would be less likely to fill.
3. **Long-haul share.** Over a quarter of SFO's seats are international, versus under a tenth at OAK. International passengers usually bring higher airline and concession revenue per passenger, so SFO's traffic is worth more.
4. **Growth.** Both airports are below 2019 levels. OAK has declined faster (81% recovered vs. 90% at SFO). This is OAK's strongest factor relative to the group, but SFO is still ahead.

## How OAK ends up at 15

The scores are consistent with a **min–max scaling** method. Within the group, the best airport on each factor gets 100 and the worst gets 0. This is my reconstruction, not the tool's published formula, but it reproduces OAK's 15:

- Congestion: about 0 (lowest of the three) × 30% ≈ **0**
- Load factor: about 12% of the way from SJC to SFO × 30% ≈ **3.7**
- International share: about 21% of the way × 20% ≈ **4.2**
- Growth: about 35% of the way × 20% ≈ **7.1**
- **Total ≈ 15**

SFO is best on every factor, so it gets 100 on each and scores 100 overall.

## Caveats

- **The 100-vs-15 gap is exaggerated by the scaling.** Because the best airport gets 100 and the worst gets 0, even moderate real differences become large score differences. OAK is not "85% worse" than SFO in any economic sense.
- **Costs are not included.** The score measures demand pressure only. Construction costs, Bay fill limits, airline agreements and fees per passenger could favor OAK on actual return, even though its demand signals are weaker.
- **Congestion is based on volume, not capacity use.** We don't have each airport's maximum runway capacity, so it's unclear how close each one is to its limit. SFO's bad-weather runway limits, which would make its constraint more binding, also aren't captured.

If you'd like, I can rerun the score for SFO and OAK to get the tool's exact per-factor contributions. I can also score OAK on its own against all U.S. airports to see whether it is weak nationally or only next to SFO.

### Turn 3
**User:** what's the weather in SF?

- **Classified as:** off_topic
- **Tools called:** (none)

**Agent answer:**

Sorry, I can only help with **U.S. airports and airport investment**: passenger traffic, comparing airports, and expansion or modernization questions.
Try something like *"How has BOS passenger traffic changed since 2019?"*

### Turn 4
**User:** ok, back to airports — add San Diego to the ranking.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["San Diego"]})`, `score_airports({"airport_codes":["SFO","OAK","SJC","SAN"]})`
  - find_airports_by_city → ok: {"results":{"San Diego":{"matchedAs":"metro","airports":[{"code":"SAN","name":"San Diego International","city":"San Diego","state":"CA","hubType":"L","latestEnplanements":12780013,"secondary":false}]}}}
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":92.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

# Bay Area + San Diego Investment Ranking

| Rank | Airport | Score (relative) | Previous score (Bay Area only) | 2024 Enplanements | Hub |
|---|---|---|---|---|---|
| 1 | **SFO**, San Francisco Intl | **92.1** | 100 | 25,078,968 | Large |
| 2 | **SAN**, San Diego Intl | **55.9** | — | 12,780,013 | Large |
| 3 | **OAK**, Oakland | **12.5** | 15 | 5,292,736 | Medium |
| 4 | **SJC**, San Jose | **0.5** | 0.1 | 5,822,019 | Medium |

SAN is the only airport the lookup returned for the San Diego metro. The scores are still relative to this group only, so adding SAN changed everyone's numbers.

## Factor comparison

| Factor (weight) | SFO | SAN | OAK | SJC |
|---|---|---|---|---|
| Congestion: departures (30%) | **190,763** | 113,704 | 47,022 | 47,285 |
| Unmet demand: load factor (30%) | **81.7%** | 79.3% | 73.8% | 72.7% |
| Long-haul: international seat share (20%) | **28.3%** | 3.9% | 9.4% | 4.4% |
| Growth: 5-yr CAGR, 2019→24 (20%) | −2.0% | **+0.2%** | −4.2% | −5.4% |
| Recovery vs. 2019 | 90% | **101%** | 81% | 76% |

## What changed

- **SAN is the only one of the four that has grown since 2019.** It is back above its 2019 passenger level (101%), while all three Bay Area airports are still below theirs. SAN now takes the full 20 points on growth.
- **That is why SFO dropped from 100 to 92.1.** SFO used to top growth by shrinking the least. Now SAN is the growth leader, and SFO gets 60.3 out of 100 on that factor, which costs it about 8 points. SFO still leads on congestion, load factor and international share.
- **SAN's score breaks down as follows:**
  - Load factor: 22.0 of 30 points. At 79.3%, it is close to the roughly 80% level where spilled demand starts to matter.
  - Congestion: 13.9 of 30 points. It has about 60% of SFO's departures.
  - Growth: 20 of 20 points.
  - Long-haul: 0 of 20 points. It has the lowest international share in the group, at 3.9%.
- **OAK and SJC barely moved.** They remain at the bottom, and their order is unchanged.

## How to read this

- **SFO** is still the strongest case on demand pressure. It is the busiest of the four, its planes run the fullest, and it carries the most high-margin international traffic. The risk is that it is still 10% below its 2019 traffic.
- **SAN** is the most balanced case. Its demand is growing and its planes are nearly as full as SFO's. However, its traffic is almost entirely domestic, so each added passenger likely brings in less revenue than at SFO.

## Caveats

1. **This is a demand comparison, not a market comparison.** SAN serves a separate Southern California market. It does not compete with the Bay Area airports for the same passengers, so it is a different investment option rather than a substitute.
2. **Congestion is based on departure volume, not capacity use.** Runway and terminal capacity (ASV) aren't in the data. A physically constrained airport could be under more pressure than its departure count suggests.
3. **Costs and feasibility are not scored.** Land availability, construction cost, airline agreements and existing cost per enplanement could change the ranking on actual return.
4. **The scaling exaggerates gaps.** SAN's 0 on long-haul means only that it is the lowest of the four on that factor, not that it has no international traffic.

**Next step:** I can score SFO and SAN individually against all U.S. airports. That would show whether either one is a top national opportunity or just the strongest of this group.

### Turn 5
**User:** Summarize your top recommendation.

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

# Top Recommendation: SFO (San Francisco International)

**SFO is the strongest expansion or modernization candidate among the four airports compared.** It scored **92.1**, well ahead of SAN (55.9), OAK (12.5) and SJC (0.5).

## Why SFO

- **Most congested.** It has 190,763 departures, about 1.7× SAN and about 4× OAK or SJC.
- **Fullest planes.** Its load factor is 81.7%, the highest in the group. That suggests airlines would add flights if there were capacity.
- **Most valuable traffic.** International flights make up 28.3% of its seats, far above the others (3.9% to 9.4%). International passengers typically bring more revenue per passenger.
- **Largest base.** It had 25.1 million enplanements in 2024, about double SAN.

## Main risk

SFO is still only **90% recovered vs. 2019**, with a 5-year growth rate of −2.0%. The demand pressure is real, but traffic has not fully returned. Any expansion case should include a recovery forecast.

## Runner-up: SAN (San Diego)

SAN is the best choice for a **growth-focused** investor. It is the only airport of the four above its 2019 traffic (101%), and its planes are nearly as full as SFO's (79.3%). Its weakness is that its traffic is almost entirely domestic.

## Limits of this recommendation

- The scores are **relative to these four airports only**, not to all U.S. airports.
- The score measures **demand pressure, not return**. It does not include construction cost, land or Bay fill limits, airline agreements or cost per enplanement.
- Congestion is measured by departure volume, not by how close each airport is to its runway or terminal capacity.

**Suggested next step:** Score SFO and SAN individually against all U.S. airports to confirm whether either is a top national opportunity.
