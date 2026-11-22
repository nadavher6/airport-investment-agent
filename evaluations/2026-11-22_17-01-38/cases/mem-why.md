# mem-why

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 resolves 'the first one' to the right airport",
    "Explains using the same figures as turn 1"
  ],
  "mustNot": [
    "Ask which airport",
    "Contradict turn 1"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare LAX and SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs SFO: Relative Investment Attractiveness

**LAX scores 80 and SFO scores 20**, but the gap is much smaller than those numbers suggest.

## Why the scores are so far apart

With only two airports, the tool scores each category relative to the pair. The better airport in a category gets 100 and the other gets 0, regardless of how close they are. Look at load factor: 81.9% vs 81.7% is effectively a tie, yet it produces a 100-to-0 split worth 30 points. So read the 80 vs 20 as "LAX wins three of four categories," not as "LAX is four times as attractive."

## Category breakdown

| Category (weight) | LAX | SFO | Winner | How big is the real gap? |
|---|---|---|---|---|
| Congestion (30%) | 266,820 departures | 190,763 departures | LAX | **Large.** About 40% more departures. |
| Unmet demand (30%) | 81.9% load factor | 81.7% load factor | LAX | **Negligible.** Both are at the ~80–85% level where demand starts being turned away on peak days. |
| Long-haul share (20%) | 30.8% international seats | 28.3% international seats | LAX | **Modest.** Both have strong international traffic, which brings higher fees. |
| Growth (20%) | –2.5%/yr (2019→2024) | –2.0%/yr (2019→2024) | SFO | **Small.** Both are still below 2019. LAX is at 87.9% of 2019 passengers and SFO at 90.3%. |

Latest passenger boardings (2024): **LAX 37.76M, SFO 25.08M.**

## Interpretation

- **LAX's real advantage is scale and airfield pressure.** It has far more flights and more international seats, so added capacity would serve a larger, higher-margin base.
- **Demand pressure is similar at both.** Planes are about 82% full at each airport, so both are turning away some demand at peak times.
- **Growth is a caution flag for both.** Neither has returned to 2019 passenger levels. LAX's slower recovery is a risk to weigh against its size: expansion assumes demand comes back.

## Data limits and assumptions

- "Congestion" here is just the number of departures. It is not measured against each airport's actual capacity, because that capacity figure isn't freely published. SFO's runway constraints (closely spaced parallel runways, weather-driven arrival limits) aren't captured in this score.
- The flight data covers the latest 12 months. The growth data uses 2019–2024.
- The score doesn't consider construction costs, land availability, regulatory or environmental hurdles, or projects already underway at either airport.

**Next step:** If you'd like a sense of absolute standing, I can score each airport individually against all U.S. airports. I could also add Bay Area or LA-area alternates (e.g., OAK, SJC, BUR, ONT) to see whether nearby secondary airports are better expansion candidates.

### Turn 2
**User:** Why is the first one higher?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**LAX scores higher because it beats SFO in three of the four weighted categories, and those three carry 80% of the total weight.**

## How the 80 vs 20 adds up

With only two airports compared, each category gives its full weight to the better airport and nothing to the other:

| Category | Weight | Winner | LAX points | SFO points |
|---|---|---|---|---|
| Congestion (departures) | 30% | LAX (266,820 vs 190,763) | 30 | 0 |
| Unmet demand (load factor) | 30% | LAX (81.9% vs 81.7%) | 30 | 0 |
| Long-haul share (intl. seats) | 20% | LAX (30.8% vs 28.3%) | 20 | 0 |
| Growth (2019→2024 CAGR) | 20% | SFO (–2.0% vs –2.5%) | 0 | 20 |
| **Total** | | | **80** | **20** |

## Which wins actually matter

- **Congestion is the real driver.** LAX runs about 40% more departures, which is a large, meaningful difference. More traffic means added capacity would serve a bigger base.
- **Long-haul share is a modest edge.** LAX has about 2.5 points more international seats, which tend to bring higher fees per passenger.
- **Unmet demand is essentially a tie.** A 0.2-point load-factor difference still hands LAX all 30 points. This inflates the gap.
- **SFO's only win, growth, is also narrow.** It is recovering slightly faster, but both airports are still below 2019 levels.

## Bottom line

LAX's lead rests mainly on scale (more flights and somewhat more international traffic). If you ignore the near-tie on load factor, the honest picture is "LAX moderately ahead," not a 4-to-1 advantage.

I can score each airport against all U.S. airports to get absolute scores, which shows the gap at its true size.
