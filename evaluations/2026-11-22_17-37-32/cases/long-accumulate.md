# long-accumulate

- **Group:** G12-long
- **Turns:** 5

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
          "LAX",
          "SFO",
          "SEA",
          "PDX"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Final ranking covers all four accumulated airports",
    "Grounded figures throughout"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Look at LAX.

- **Classified as:** in_scope
- **Tools called:** `get_airport_by_code({"code":"LAX"})`, `get_enplanements({"airport_code":"LAX"})`, `score_airports({"airport_codes":["LAX"]})`
  - get_airport_by_code → ok: {"code":"LAX","name":"Los Angeles International","city":"Los Angeles","state":"CA","hubType":"L","latestEnplanements":37760834}
  - get_enplanements → ok: {"airportCode":"LAX","name":"Los Angeles International","city":"Los Angeles","state":"CA","hubType":"L","series":[{"year":2015,"enplanements":36351272,"rank":2,"hubType":"L"},{"year":2016,"enplanements":39636042,"rank":2,"hubType":"L"},{"year":2017,"enplanements":41232432,"rank":2,"hubType":"L"},{"year":2018,"enplanements":42624050,"rank":2,"hubType":"L"},{"year":2019,"enplanements":42939104,"rank…
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":89.2,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

# LAX (Los Angeles International): Investment Snapshot

**Bottom line:** LAX scores **89.2 / 100** on the Investment Attractiveness Score, measured against all U.S. airports. Three of the four categories are at or near the top of the scale. The weak spot is growth: passenger traffic is still well below its 2019 peak and fell again in 2024. That makes a straight capacity-expansion case harder to argue than the headline score suggests.

## Airport profile
- Large hub, Los Angeles, CA
- **37,760,834 enplanements in CY2024**, ranked **#5** in the U.S.

## Score breakdown

| Category | Weight | Sub-score | Contribution | Key input |
|---|---|---|---|---|
| Congestion | 30% | 100 | 30.0 | 266,820 departures (latest 12 months) |
| Unmet demand | 30% | 99.3 | 29.8 | 81.9% load factor |
| Long-haul share | 20% | 100 | 20.0 | 30.8% international seats |
| Growth | 20% | 47.1 | 9.4 | −2.5% 5-yr CAGR |
| **Total** | | | **89.2** | All four categories have data |

## What's driving it
- **Very busy airfield.** About 267K departures puts LAX at the maximum congestion sub-score. This is a volume proxy, not true capacity utilization, because the airport's annual service volume (ASV) isn't published.
- **Planes run full.** An 81.9% load factor (35.9M passengers on 43.9M seats) is in the range where some peak-day demand is likely being turned away.
- **Strong international business.** 30.8% of seats (13.5M) are international. That traffic is higher-margin and protected by customs and international-terminal infrastructure that competitors can't easily replicate.

## The concern: traffic trend

| Year | Enplanements | Rank |
|---|---|---|
| 2015 | 36.35M | 2 |
| 2019 (peak) | 42.94M | 2 |
| 2020 | 14.06M | 5 |
| 2023 | 40.96M | 2 |
| 2024 | 37.76M | 5 |

- 2024 was **down 7.8%** from 2023, and the national rank slipped from #2 to #5.
- Traffic has recovered to only **87.9% of 2019**, which is about 5.2M fewer annual enplanements than the peak.
- The 5-year CAGR (2019→2024) is **−2.5%**. The longer-run rate (2015→2024) is +0.42%, calculated over 9 periods, so it isn't a true 10-year figure.

## What this means for investment
LAX handled about 42.9M enplanements in 2019. It is now running roughly 5M below that level, yet planes are still about 82% full. The more likely explanation is that **airlines have cut seats**, not that the airport has run out of physical room.

This points the investment case toward:
- **Modernization and quality-of-service projects**, such as terminals, international gates, ground access, and customs/FIS capacity
- **Not a pure "add runway or passenger capacity" play**

Before committing capital, it would be worth finding out why 2024 dropped. Possible causes include airline capacity decisions, construction disruption, or passengers shifting to other airports in the region.

## Data caveats
- **Different data sources.** Enplanements are FAA calendar-year 2024 figures. Departures, seats, and load factor come from BTS T-100 data for the "latest 12 months," so the two passenger counts (37.8M vs. 35.9M) don't match exactly.
- **Inconsistent labeling.** The growth category's formula is labeled FY2019→FY2024, but the underlying numbers are calendar-year.
- **Absolute scoring.** The score compares LAX with all U.S. airports. A score near 100 does not mean LAX beats nearby alternatives.

## Possible next steps
- **Compare regionally:** score LAX against other Los Angeles–area airports (e.g., BUR, ONT, SNA, LGB) to check whether traffic is shifting to them.
- **Benchmark against peers:** compare LAX with other large West Coast hubs such as SFO and SEA.

### Turn 2
**User:** Now add SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs. SFO: Head-to-Head

**Bottom line:** LAX ranks first with **80 vs. 20**, but the gap is much wider than the underlying data. With only two airports, each category scores the leader 100 and the trailer 0, so tiny differences get magnified. On the actual metrics the two airports are closer than the scores suggest. LAX leads clearly on scale, and SFO leads modestly on recovery.

## Score breakdown (relative: best of these two = 100)

| Category | Weight | LAX | SFO | Underlying data (LAX vs. SFO) | Real gap |
|---|---|---|---|---|---|
| Congestion | 30% | 100 → 30.0 | 0 → 0 | 266,820 vs. 190,763 departures | **Large:** LAX ~40% busier |
| Unmet demand | 30% | 100 → 30.0 | 0 → 0 | 81.9% vs. 81.7% load factor | **Negligible:** 0.2 pts |
| Long-haul share | 20% | 100 → 20.0 | 0 → 0 | 30.8% vs. 28.3% international seats | **Modest:** 2.5 pts |
| Growth | 20% | 0 → 0 | 100 → 20.0 | −2.5% vs. −2.0% 5-yr CAGR | **Small:** both shrinking |
| **Total** | | **80** | **20** | Full data coverage for both | |

## What actually separates them
- **Scale is the real difference.** LAX runs about 76K more departures, 11.4M more seats (43.9M vs. 32.5M), and 4.3M more international seats (13.5M vs. 9.2M). In 2024 it had 37.76M enplanements to SFO's 25.08M.
- **Demand pressure is essentially the same.** Both run around 82% full. That is near the ~80–85% range where some peak demand gets turned away, and neither airport has an edge here.
- **Both are still below 2019.** SFO is at **90.3%** of its 2019 traffic and LAX at **87.9%**. SFO's decline is a bit shallower (−2.0%/yr vs. −2.5%/yr), but neither airport is growing.

## What this means for investment
The two airports share the same pattern: full planes on fewer seats than in 2019. That points to airlines limiting capacity rather than the airports running out of physical room. For both, the case leans toward **modernization** (terminals, international and customs facilities, passenger experience) rather than **pure capacity expansion**.

LAX's lead comes mainly from being bigger. More traffic means more revenue for an upgrade to work on, but bigger isn't the same as more profitable per dollar invested. SFO's slightly stronger recovery is a small point in its favor if you weight how durable the traffic is.

## Caveats
- **Different scoring modes.** LAX's earlier **89.2** was an absolute score against all U.S. airports. Today's **80** is relative to SFO only. The two numbers can't be compared.
- **Proxies and data mismatches.** Congestion is measured by traffic volume because each airport's true capacity (ASV) isn't published. Enplanement counts are FAA calendar-year data, while departures, seats, and load factor are BTS figures for the latest 12 months.
- **Missing SFO details.** I haven't yet pulled SFO's full enplanement history, so its 2024 year-over-year change and national rank aren't shown here.

## Suggested next steps
- **Score SFO on its own** to get an absolute score that's directly comparable to LAX's 89.2.
- **Pull SFO's enplanement history** to see whether it also dropped in 2024, as LAX did (−7.8%).
- **Widen the comparison** to more hubs (e.g., SEA) or each metro's secondary airports (OAK/SJC, BUR/ONT/SNA/LGB). A larger set makes relative scores far more meaningful than a two-way comparison.

### Turn 3
**User:** Add SEA too.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO","SEA"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs. SFO vs. SEA: Three-Way Comparison

**Bottom line:** LAX still ranks first (**80**), followed by SFO (**35.7**) and SEA (**28.7**). The ranking hides an important split, though. **SEA is the only one of the three that has fully recovered and is growing**, which makes it the strongest candidate for actual capacity expansion. LAX and SFO look more like modernization plays.

## Score breakdown (relative: best of these three = 100)

| Category | Weight | LAX | SFO | SEA | Underlying data (LAX / SFO / SEA) |
|---|---|---|---|---|---|
| Congestion | 30% | 100 → 30.0 | 0 → 0 | 29 → 8.7 | 266,820 / 190,763 / 212,841 departures |
| Unmet demand | 30% | 100 → 30.0 | 50 → 15.0 | 0 → 0 | 81.9% / 81.7% / 81.5% load factor |
| Long-haul share | 20% | 100 → 20.0 | 85.4 → 17.1 | 0 → 0 | 30.8% / 28.3% / 13.7% international seats |
| Growth | 20% | 0 → 0 | 17.9 → 3.6 | 100 → 20.0 | −2.5% / −2.0% / +0.3% 5-yr CAGR |
| **Total** | | **80** | **35.7** | **28.7** | Full data coverage for all three |

## What the scores get right and wrong

**Real differences:**
- **Scale (LAX).** LAX has the most departures, seats (43.9M) and international seats (13.5M).
- **International mix (SEA trails).** SEA's 13.7% international share is less than half of LAX's or SFO's. This is a genuine gap in high-margin traffic.
- **Growth (SEA leads).** SEA is at **101.7% of 2019** traffic, while LAX is at 87.9% and SFO at 90.3%.

**Noise that the scoring magnifies:**
- **Load factor.** The three airports are only **0.4 points apart** (81.5–81.9%). That spread still gives LAX 30 points, SFO 15 and SEA 0. If you treat it as a tie and drop that category, the totals are LAX 50, **SEA 28.7, SFO 20.7**, so SEA passes SFO.
- **SFO's score rose from 20 to 35.7** only because SEA now sets the bottom in two categories. SFO's own data didn't change.

**A detail worth noting:** SEA runs about 22K more departures than SFO on about 1.5M fewer seats. That points to smaller average aircraft, likely more regional and short-haul flying. Its airfield is busier than its passenger count alone would suggest.

## What this means for investment

| Airport | Profile | Investment angle |
|---|---|---|
| **LAX** | Largest and most international, but 5.2M enplanements below 2019 | Modernization: terminals, international and customs facilities, ground access |
| **SFO** | Similar to LAX at smaller scale, still below 2019 | Modernization, same reasoning as LAX |
| **SEA** | Fully recovered, growing, planes ~82% full, busy airfield | **Best fit for capacity expansion** (gates, airfield throughput). Upside is more domestic than international |

LAX's lead reflects its size. If your question is specifically *where added capacity will fill*, SEA has the strongest evidence of the three. Its 0.3%/yr growth is modest, however, so this is a relative advantage rather than a boom.

## Caveats
- **Relative scores only.** These scores compare the three airports with each other. They can't be compared with LAX's absolute 89.2.
- **Small sample.** With three airports, each category still assigns 100 to the best and 0 to the worst, so small gaps get exaggerated.
- **Proxies and mixed sources.** Congestion is measured by departures because true capacity (ASV) isn't published. Enplanements are FAA calendar-year 2024 data, while the other metrics are BTS figures for the latest 12 months.
- **Missing history.** I haven't pulled full enplanement histories for SFO or SEA, so their 2024 year-over-year changes and national ranks aren't shown.

## Suggested next steps
- **Score SFO and SEA individually** to get absolute scores comparable to LAX's 89.2.
- **Pull SEA's enplanement history** to check whether its growth continued through 2024 or flattened.
- **Add more growing hubs** (e.g., other Pacific Northwest or Mountain West airports) to test whether SEA's growth stands out or is typical.

### Turn 4
**User:** And PDX.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO","SEA","PDX"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs. SFO vs. SEA vs. PDX: Four-Way Comparison

**Bottom line:** Adding PDX changes little at the top. LAX still ranks first (**80**). SFO (**58.8**) and SEA (**57.9**) are now essentially tied. PDX finishes last at **0.4**. PDX is the smallest of the four, the least international, and is shrinking about as fast as LAX. Its numbers also show that SEA's growth comes from SEA itself, since its neighbor in the same region is not growing.

## Score breakdown (relative: best of these four = 100)

| Category | Weight | LAX | SFO | SEA | PDX | Underlying data (LAX / SFO / SEA / PDX) |
|---|---|---|---|---|---|---|
| Congestion | 30% | 100 → 30.0 | 57.1 → 17.1 | 69.5 → 20.8 | 0 → 0 | 266,820 / 190,763 / 212,841 / 89,627 departures |
| Unmet demand | 30% | 100 → 30.0 | 66.7 → 20.0 | 33.3 → 10.0 | 0 → 0 | 81.9% / 81.7% / 81.5% / 81.3% load factor |
| Long-haul share | 20% | 100 → 20.0 | 90.6 → 18.1 | 35.5 → 7.1 | 0 → 0 | 30.8% / 28.3% / 13.7% / 4.3% international seats |
| Growth | 20% | 0 → 0 | 17.9 → 3.6 | 100 → 20.0 | 1.8 → 0.4 | −2.5% / −2.0% / +0.3% / −2.5% 5-yr CAGR |
| **Total** | | **80** | **58.8** | **57.9** | **0.4** | Full data coverage for all four |

## PDX profile
- **8,639,088 enplanements in CY2024.** That is roughly a third of SFO's or SEA's volume and under a quarter of LAX's.
- **88.2% recovered vs. 2019.** I derived a 2019 level of about 9.8M from that ratio, so PDX is roughly 1.2M enplanements short.
- **−2.5% 5-year CAGR.** This is effectively the same decline as LAX (−2.49% vs. −2.54%), but on a much smaller base.
- **4.3% international seats** (about 0.49M of 11.4M). PDX is almost entirely a domestic airport.
- **81.3% load factor.** Planes run nearly as full as at the other three.
- **About 128 seats per departure,** compared with about 146 at SEA, 164 at LAX and 170 at SFO. PDX flies the smallest average aircraft of the group.

## How adding PDX changed the picture
- **SFO and SEA moved up** from 35.7 and 28.7 to 58.8 and 57.9. Their own data didn't change. PDX now sets the bottom of every range except growth, which pulled both airports' sub-scores up. This is how relative scoring works, not a change in either airport.
- **SEA nearly caught SFO.** Because PDX widened the congestion and international ranges, SEA's busier airfield counts for more and SFO's international lead counts for less.
- **Load factor is still mostly noise.** All four airports fall within **0.6 points** (81.3–81.9%), yet that category alone is worth 30 points. If you treat it as a tie and drop it, the totals become **LAX 50, SEA 47.9, SFO 38.8, PDX 0.4**. On that basis SEA is close to LAX and clearly ahead of SFO.

## What this means for investment

| Airport | Profile | Investment angle |
|---|---|---|
| **LAX** | Largest, most international, about 12% below 2019 | Modernization (terminals, international and customs facilities, ground access) |
| **SFO** | LAX-like at smaller scale, about 10% below 2019 | Modernization |
| **SEA** | Only airport above 2019 traffic, busy airfield, full planes | **Best capacity-expansion candidate** in this set, with mostly domestic upside |
| **PDX** | Small, domestic, about 12% below 2019 | **Weakest case.** Demand isn't growing and planes aren't notably fuller than elsewhere. Any spending would be modernization or maintenance, not expansion |

**Regional signal:** SEA and PDX both serve the Pacific Northwest, but they are moving in opposite directions. SEA is at +0.3%/yr and PDX at −2.5%/yr. So SEA's growth can't be credited to the whole region. It may reflect hub consolidation at SEA. That would fit with PDX's small aircraft and very low international share, but it is a hypothesis, not something this data proves.

## Caveats
- **Relative scores only.** These scores compare the four airports with each other. They aren't comparable to LAX's absolute 89.2 or to the earlier two- and three-way results.
- **Scale dominates.** PDX is so much smaller that it sits at the bottom of most ranges. Its 0.4 means "worst of this group," not "worthless." An absolute score would place it more fairly against airports its own size.
- **Proxies and mixed sources.** Congestion is measured by departures because true capacity (ASV) isn't published. Enplanements are FAA calendar-year 2024 data, while the other metrics are BTS figures for the latest 12 months.
- **Derived figures.** The PDX 2019 level and the seats-per-departure numbers are my own arithmetic from the tool outputs, not reported values.

## Suggested next steps
- **Score PDX alone** to see how it ranks against all U.S. airports, which is a fairer test for an airport of its size.
- **Pull enplanement histories for SEA and PDX** to check whether PDX's losses line up with SEA's gains over time.
- **Compare PDX with peers of similar size** (e.g., other airports around 8–10M enplanements) rather than large international hubs.

### Turn 5
**User:** Rank everything we've looked at so far.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO","SEA","PDX"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# Final Ranking: All Four Airports

**Bottom line:** The full ranking is **LAX (80) > SFO (58.8) > SEA (57.9) > PDX (0.4)**. This re-run matches the four-way result above exactly, so the scoring is consistent. LAX ranks first mainly because it is the largest. SFO and SEA are effectively tied. For adding capacity specifically, **SEA has the strongest case**.

## Official ranking (relative: best of these four = 100)

| Rank | Airport | Score | Congestion (30%) | Unmet demand (30%) | Long-haul (20%) | Growth (20%) | Best-fit investment |
|---|---|---|---|---|---|---|---|
| 1 | **LAX** | **80.0** | 30.0 | 30.0 | 20.0 | 0 | Modernization |
| 2 | **SFO** | **58.8** | 17.1 | 20.0 | 18.1 | 3.6 | Modernization |
| 3 | **SEA** | **57.9** | 20.8 | 10.0 | 7.1 | 20.0 | **Capacity expansion** |
| 4 | **PDX** | **0.4** | 0 | 0 | 0 | 0.4 | Maintenance or modest upgrades |

All four airports have full data coverage.

## Key data behind the ranking

| Metric | LAX | SFO | SEA | PDX |
|---|---|---|---|---|
| Departures (latest 12 mo) | 266,820 | 190,763 | 212,841 | 89,627 |
| Load factor | 81.9% | 81.7% | 81.5% | 81.3% |
| International seat share | 30.8% | 28.3% | 13.7% | 4.3% |
| 5-yr enplanement CAGR | −2.5% | −2.0% | **+0.3%** | −2.5% |
| 2024 vs. 2019 traffic | 87.9% | 90.3% | **101.7%** | 88.2% |
| CY2024 enplanements | 37.76M | 25.08M | 25.41M | 8.64M |

## Alternative view: treat load factor as a tie

All four load factors fall within **0.6 points** of each other, yet that category is worth 30% of the score. If you set it aside as noise:

| Rank | Airport | Adjusted score |
|---|---|---|
| 1 | LAX | 50.0 |
| 2 | **SEA** | **47.9** |
| 3 | SFO | 38.8 |
| 4 | PDX | 0.4 |

On this basis SEA moves clearly ahead of SFO and comes close to LAX. **I'd consider this the more realistic ordering.**

## How to read it
- **LAX:** It has the largest revenue base and the most international traffic, but it is still about 12% below 2019. Upgrades would make sense because of its size, not because demand is outgrowing the airport.
- **SFO:** It follows the same pattern as LAX at a smaller scale. It is a modernization play.
- **SEA:** It is the only airport above 2019 traffic and it is still growing, so it is the one most likely to fill new capacity. The growth is modest, and the upside is mostly domestic.
- **PDX:** It is small, almost entirely domestic, and shrinking. Its 0.4 means "weakest of this group," not "worthless." It is being compared against three much larger hubs.

## Caveats
- **Relative scores only.** These scores aren't comparable to LAX's earlier absolute score of 89.2.
- **Congestion is a proxy.** It is measured by departures because true capacity (ASV) isn't published.
- **Mixed data sources.** Enplanements are FAA calendar-year 2024 data. The other metrics are BTS figures for the latest 12 months.
- **Adjusted ranking is my own calculation.** I built it from the tool's category contributions. It is not an output of the scoring tool.

## Suggested next steps
- **Score SFO, SEA and PDX on their own** to get absolute scores comparable to LAX's 89.2.
- **Pull SEA's year-by-year enplanements** to confirm its growth held up through 2024.
- **Benchmark PDX against similar-sized airports** rather than large hubs.
