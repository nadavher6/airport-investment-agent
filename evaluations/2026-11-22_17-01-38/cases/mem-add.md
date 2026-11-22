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

# LAX vs. SFO: Relative Investment Attractiveness

| Rank | Airport | Score | Congestion (30%) | Unmet demand (30%) | Long-haul (20%) | Growth (20%) |
|---|---|---|---|---|---|---|
| 1 | **LAX**, Los Angeles International | **80** | 100 → 30 pts | 100 → 30 pts | 100 → 20 pts | 0 → 0 pts |
| 2 | **SFO**, San Francisco International | **20** | 0 → 0 pts | 0 → 0 pts | 0 → 0 pts | 100 → 20 pts |

Both airports have full data coverage.

## The underlying numbers

| Metric (latest 12 months, BTS T-100) | LAX | SFO | Difference |
|---|---|---|---|
| Departures | 266,820 | 190,763 | LAX has about 40% more |
| Load factor | 81.9% | 81.7% | 0.2 points |
| International seat share | 30.8% | 28.3% | 2.5 points |
| 5-yr enplanement CAGR (2019→2024) | −2.5%/yr | −2.0%/yr | 0.5 points |
| 2024 vs. 2019 traffic | 88% | 90% | 2 points |
| 2024 enplanements | 37.8M | 25.1M | |

## Why the gap looks bigger than it is

With only two airports, the scoring is relative. On every metric the better airport gets 100 and the other gets 0, however small the difference. As a result, the 80-vs-20 spread overstates how different these airports are:

- **Unmet demand is effectively a tie.** A 0.2-point load-factor gap earned LAX the full 30 points. Both airports run at about 82%, which is at the low end of the roughly 80–85% range where demand starts getting turned away at peaks.
- **Long-haul is close.** Both airports have a strong international share, near 30%. LAX's lead is modest.
- **Congestion is the one real difference.** LAX handles about 76,000 more departures. Note that this measures volume, not runway or airfield capacity, so it doesn't show how close either airport is to its actual limit.
- **SFO "wins" growth only by shrinking less.** Both airports are still below 2019 traffic. Neither shows positive growth momentum.

## Takeaway

On these metrics, LAX is the stronger candidate for capacity investment. It has more airfield activity and a slightly higher international mix, at the same load factor as SFO. However, the margin is much narrower than 80 vs. 20 suggests. Both airports also share the same weakness: traffic is still 10–12% below 2019. That raises the question of whether adding capacity is the bottleneck, or whether filling the capacity they already have comes first.

## Data limits

- The congestion measure uses departures as a stand-in for capacity pressure, because annual service volume (the airfield's capacity) isn't published.
- Load factor is a 12-month average, so it understates peak-hour crowding.
- The score doesn't include costs, airport financials, gate or terminal constraints, or airline commitments.

If you'd like, I can score each airport on its own to see how both compare against all U.S. airports. That would be a better sense of their actual standing than this head-to-head. I can also add other West Coast airports for a broader comparison.

### Turn 2
**User:** Add Denver.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Denver"]})`, `score_airports({"airport_codes":["LAX","SFO","DEN"]})`
  - find_airports_by_city → ok: {"results":{"Denver":{"matchedAs":"metro","airports":[{"code":"DEN","name":"Denver International","city":"Denver","state":"CO","hubType":"L","latestEnplanements":40012895,"secondary":false}]}}}
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":64.7,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":49,"contribution":14.7,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)…

**Agent answer:**

# LAX vs. SFO vs. Denver: Relative Investment Attractiveness

| Rank | Airport | Score | Congestion (30%) | Unmet demand (30%) | Long-haul (20%) | Growth (20%) |
|---|---|---|---|---|---|---|
| 1 | **LAX**, Los Angeles International | **64.7** | 49 → 14.7 pts | 100 → 30 pts | 100 → 20 pts | 0 → 0 pts |
| 2 | **DEN**, Denver International | **50.0** | 100 → 30 pts | 0 → 0 pts | 0 → 0 pts | 100 → 20 pts |
| 3 | **SFO**, San Francisco International | **44.2** | 0 → 0 pts | 81.8 → 24.5 pts | 90 → 18 pts | 8.4 → 1.7 pts |

All three airports have full data coverage.

## The underlying numbers

| Metric | LAX | DEN | SFO |
|---|---|---|---|
| Departures (latest 12 mo., BTS T-100) | 266,820 | **345,892** | 190,763 |
| Load factor | **81.9%** | 80.8% | 81.7% |
| International seat share | **30.8%** | 5.8% | 28.3% |
| 5-yr enplanement CAGR (2019→2024) | −2.5%/yr | **+3.6%/yr** | −2.0%/yr |
| 2024 vs. 2019 traffic | 88% | **119%** | 90% |
| 2024 enplanements | 37.8M | **40.0M** | 25.1M |

## How to read this

**SFO's score rose from 20 to 44.2, but SFO didn't change.** The scores are relative. Adding Denver stretched the scale on every metric, so SFO now sits close to LAX on load factor and international share instead of at zero.

**Denver's 0 on unmet demand is mostly a scaling effect.** Denver's load factor is 80.8%, only 1.1 points below LAX. That small gap cost Denver all 30 points in that category. All three airports are effectively tied at the low end of the roughly 80–85% range where demand starts being turned away at peaks.

If load factor is treated as a tie and that category is removed, the other three categories give:

- DEN: 50
- LAX: 34.7
- SFO: 19.7

Denver would rank first.

**Denver's 0 on long-haul is a real difference.** Denver's international share is 5.8%, compared with about 30% at the two coastal airports. Denver is mainly a domestic connecting hub. That means less of the high-margin international traffic, which is a genuine weakness for revenue per passenger.

## Takeaway

- **LAX ranks first under the official weighting.** It combines high volume with the strongest international mix. However, its traffic is still 12% below 2019.
- **Denver arguably has the clearest case for capacity expansion.** It is the only one of the three that is growing: about 19% above 2019 and +3.6% per year. It also has the most departures and the most passengers. Its lower score comes from a near-tie on load factor and from its domestic focus. Expansion there would mainly add domestic capacity, not premium international traffic.
- **SFO is solid on mix but trails on volume and growth.** Like LAX, it is still below 2019.

In short, LAX is the pick if you prioritize yield (international traffic). Denver is the pick if you prioritize demand that is actually growing into existing capacity.

## Data limits

- Congestion is measured by departures, which shows volume rather than how close the airfield is to its actual capacity.
- Load factor is a 12-month average and understates peak-hour crowding.
- With three airports, small gaps are still magnified on the 0–100 scale.
- The score excludes costs, airport financials, gate and terminal constraints, and airline commitments.

I can score each airport on its own against all U.S. airports to get a sense of their actual standing, or add more hubs to the comparison.
