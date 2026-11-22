# cmp-followup

- **Group:** G6-compare
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 gives a clear recommendation grounded in the turn-1 sub-scores",
    "Explains the trade-off (e.g. growth vs long-haul)"
  ],
  "mustNot": [
    "Invent figures",
    "Contradict turn 1"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare DEN and PHX for investment.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["DEN","PHX"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"DEN","name":"Denver International","score":100,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","inpu…

**Agent answer:**

# DEN vs PHX: Investment Comparison

**Denver (DEN) ranks ahead of Phoenix (PHX) on every scored category.** However, the 100 vs 0 result overstates the gap. With only two airports, the relative score gives the better one 100 and the other 0 in each category, no matter how small the difference. The underlying numbers are much closer than that suggests.

## Side by side

| Category (weight) | DEN | PHX | Gap |
|---|---|---|---|
| **Congestion**, annual departures, latest 12 mo (30%) | 345,892 | 221,624 | DEN has ~56% more |
| **Unmet demand**, load factor (30%) | 80.8% | 79.1% | +1.7 pts DEN |
| **Long-haul**, international seat share (20%) | 5.8% | 5.4% | +0.4 pts DEN |
| **Growth**, 5-yr enplanement CAGR 2019→2024 (20%) | 3.56%/yr | 2.67%/yr | +0.9 pts DEN |
| 2024 vs 2019 traffic | 1.19× | 1.14× | Both fully recovered |
| 2024 enplanements | 40.0M | 25.6M | |

## What this means

- **Congestion is DEN's clearest advantage.** It handles far more flights than PHX, which points to more pressure on runways, gates and terminals. That pressure is what tends to justify capacity spending.
- **Demand pressure is similar at both airports.** Both load factors sit near 80%. That is roughly where airlines start turning away passengers on peak days. DEN is only slightly more full, so neither airport is clearly short of seats overall.
- **Neither airport has much international traffic.** International seats are only 5–6% at both, which limits the higher-margin traffic that comes with international flights. DEN's lead here is minor.
- **DEN is growing faster.** It added about 0.9 points more per year since 2019 and has recovered further past its 2019 traffic.

**Bottom line:** DEN is the stronger expansion candidate. Its lead comes mainly from flight volume and faster growth, not from a large difference in unmet demand. PHX is not a weak airport; it simply trails a peer that is stronger on every measure.

## Assumptions and data limits

- **Congestion uses flight volume as a stand-in for capacity pressure.** Each airport's annual service volume (how many flights its airfield can handle) isn't freely published. A larger airport like DEN may also have more airfield capacity, so its real congestion could be lower than the raw count suggests.
- **Load factor is an annual average.** It does not show peak-hour or seasonal crunches.
- **The data does not include project-level economics.** Construction costs, airline agreements, existing capital plans and financing terms all affect actual profitability.

If it would help, I can score each airport against all U.S. airports. That would show where both sit nationally instead of only against each other.

### Turn 2
**User:** Which one should I prioritize and why?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**Prioritize Denver (DEN).** The data from the comparison above favors it on every measure, and its lead rests on the two factors that best signal a need for new capacity.

## Why DEN

1. **Much more flight volume.** DEN runs about 346K departures a year versus about 222K at PHX, roughly 56% more. Congestion carries the largest weight (30%) because heavy traffic on runways, gates and terminals is the clearest sign that expansion will be used.

2. **Faster growth.** DEN grew 3.56% a year from 2019 to 2024, compared with 2.67% at PHX. It is also further past its pre-COVID traffic (1.19× vs 1.14×). New capacity pays back sooner when demand keeps rising to fill it.

3. **More passengers to earn from.** DEN boarded 40.0M passengers in 2024 versus 25.6M at PHX. Much of an airport's revenue scales with passengers, including parking, concessions and per-passenger fees. So each dollar spent on capacity has a larger base to earn from.

4. **No weaker area.** DEN is also slightly ahead on load factor (80.8% vs 79.1%) and international seat share (5.8% vs 5.4%). These gaps are small, but none of them points the other way.

## What could change the ranking

- **Remaining airfield capacity.** DEN has more departures, but it may also have more room to handle them. If its existing runways and gates still have spare capacity, its real congestion may be lower than the flight count suggests. That would weaken its main advantage.
- **Ease of executing a project.** This data doesn't include construction costs, existing capital programs, airline agreements or financing terms. A cheaper, simpler project at PHX could earn a better return even though PHX scores lower.
- **Neither airport has a clear seat shortage.** Both load factors are near 80%. The case for DEN is about volume and growth, not about passengers being turned away.

## Bottom line

DEN should be the first candidate for detailed study. Before committing, check its remaining airfield and terminal capacity, and compare the costs of the projects actually planned at each airport. Keep PHX as the alternative in case DEN's capacity or project costs turn out worse than expected.

I can also score both airports against all U.S. airports. That would show whether DEN is a strong candidate nationally or only stronger than PHX.
