# mem-add

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "score_airports",
      "optional": true,
      "inputContains": {
        "airport_codes": [
          "DEN"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Turn 2 re-ranks including Denver"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank LAX and SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs. SFO: Investment Attractiveness Ranking

| Rank | Airport | Score (relative) |
|---|---|---|
| 1 | **LAX**, Los Angeles International | **80** |
| 2 | **SFO**, San Francisco International | **20** |

## How the scores break down

| Category (weight) | LAX | SFO | Winner |
|---|---|---|---|
| Congestion (30%) | 266,820 departures | 190,763 departures | LAX (+30 pts) |
| Unmet demand / load factor (30%) | 81.9% | 81.7% | LAX (+30 pts) |
| Long-haul share (20%) | 30.8% international seats | 28.3% international seats | LAX (+20 pts) |
| Growth, 5-yr CAGR 2019→2024 (20%) | −2.5%/yr (88% of 2019 traffic) | −2.0%/yr (90% of 2019 traffic) | SFO (+20 pts) |

LAX wins three of the four categories, which together carry 80% of the weight. SFO wins only growth, which carries 20%.

## Important caveats

**1. With two airports, the 80/20 gap looks bigger than it is.** In relative mode, the better airport in each category gets 100 and the worse gets 0, however small the difference. Some of these margins are tiny:
- **Load factor: 81.9% vs. 81.7%.** That is effectively a tie. Yet it moves 30 points to LAX.
- **International share: 30.8% vs. 28.3%.** This is a modest gap that moves 20 points.
- **Growth: −2.5% vs. −2.0%.** Both are negative, but SFO collects all 20 points.

The only large, meaningful gap is **congestion**. LAX runs about 40% more departures (roughly 76,000 more per year).

**2. Congestion is measured by volume, not by capacity.** The data shows how many departures each airport handles, not how close each is to its physical limit. SFO's closely spaced parallel runways restrict operations in poor weather, so it may be more constrained relative to its capacity than the raw counts suggest.

**3. Neither airport has recovered to 2019 traffic levels.** LAX is at about 88% of its 2019 passengers and SFO at about 90%. Both still have unused pre-pandemic capacity, which weakens the case for adding capacity at either airport right now.

## Bottom line

LAX ranks higher, mainly because of its much larger operating volume and slightly larger international share. On demand quality (how full the planes are and how much traffic is international), the two airports are nearly identical. Their growth trends are similarly weak.

For an absolute view, I can score each airport against all U.S. airports. That would show whether either one is attractive in national terms, not just relative to the other. I can also add peers such as SAN, SJC, or OAK for a broader West Coast comparison.

### Turn 2
**User:** Add Denver.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Denver"]})`, `score_airports({"airport_codes":["LAX","SFO","DEN"]})`
  - find_airports_by_city → ok: {"results":{"Denver":{"matchedAs":"metro","airports":[{"code":"DEN","name":"Denver International","city":"Denver","state":"CO","hubType":"L","latestEnplanements":40012895,"secondary":false}]}}}
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":64.7,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":49,"contribution":14.7,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)…

**Agent answer:**

# LAX vs. SFO vs. DEN: Investment Attractiveness Ranking

| Rank | Airport | Score (relative, 3-airport set) |
|---|---|---|
| 1 | **LAX**, Los Angeles International | **64.7** |
| 2 | **DEN**, Denver International | **50.0** |
| 3 | **SFO**, San Francisco International | **44.2** |

## Score breakdown

| Category (weight) | LAX | DEN | SFO |
|---|---|---|---|
| Congestion (30%), departures | 266,820 → 14.7 pts | **345,892 → 30 pts** | 190,763 → 0 pts |
| Unmet demand (30%), load factor | **81.9% → 30 pts** | 80.8% → 0 pts | 81.7% → 24.5 pts |
| Long-haul share (20%), international seats | **30.8% → 20 pts** | 5.8% → 0 pts | 28.3% → 18 pts |
| Growth (20%), 5-yr CAGR 2019→2024 | −2.5%/yr → 0 pts | **+3.6%/yr → 20 pts** | −2.0%/yr → 1.7 pts |
| **Total** | **64.7** | **50.0** | **44.2** |

## What changed and why

**LAX and SFO scores moved, but their order did not.** LAX went from 80 to 64.7, and SFO went from 20 to 44.2. In relative mode, each category is rescaled so the best airport in the set scores 100 and the worst scores 0. Denver now sets the top of the congestion and growth scales and the bottom of the load-factor and international scales. That moves SFO off the floor in those last two categories. The scores only describe this set of three airports. They cannot be compared with the earlier two-airport scores.

## How to read the result

**Denver is a very different investment profile from the other two:**
- **It is the only airport growing.** DEN carried 40.0M enplanements in 2024, which is about 119% of its 2019 level. LAX is at about 88% of 2019 and SFO at about 90%. On the "is demand outgrowing capacity?" question, DEN has the strongest evidence of the three.
- **It is the busiest airfield.** DEN had about 30% more departures than LAX.
- **Its traffic is overwhelmingly domestic.** Only 5.8% of its seats are international, compared with roughly 28–31% at the California airports. International traffic usually brings higher-margin revenue, so DEN loses ground on that category.

**Load factor contributes noise, not signal.** All three airports fall between 80.8% and 81.9%, a spread of just 1.1 percentage points. Even so, this category moves a full 30 points. The scaling turns a near-tie into the largest single swing against DEN. If you treat load factor as a tie, DEN (50) would effectively edge out LAX (34.7).

**Congestion is measured by volume, not by how close each airport is to its physical limit.** The tool says it uses departures because airfield capacity (ASV) data isn't freely published. One correction to my last answer: my comment about SFO's runway layout came from general background, not from this dataset. Treat it as context to verify, not as a scored input.

## Bottom line

- **LAX** ranks first because of its high-value demand mix: the most international traffic and the fullest planes. However, its traffic is still shrinking compared with 2019.
- **DEN** is the strongest **capacity-expansion** story. It has the highest volume and is the only airport with real post-2019 growth. Its weakness is the low share of international traffic.
- **SFO** trails on volume and growth, though its demand mix is close to LAX's.

If your thesis is "add capacity where demand is outgrowing it," DEN deserves more weight than its #2 rank suggests. Next, I can run **absolute scores** for each airport against all U.S. airports, which avoids the min-max scaling distortion. I can also add growth peers such as LAS, PHX, or DFW.
