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

# LAX vs. SFO: Investment Attractiveness

**Relative score: LAX 80, SFO 20.** The 60-point gap overstates the real difference, as explained below.

## Category breakdown

| Category (weight) | LAX | SFO | Edge |
|---|---|---|---|
| **Congestion** (30%): departures, latest 12 months | 266,820 | 190,763 | LAX, about 40% more flights |
| **Unmet demand** (30%): load factor | 81.9% | 81.7% | Essentially tied |
| **Long-haul share** (20%): international seats | 30.8% | 28.3% | LAX, slightly |
| **Growth** (20%): 5-yr enplanement CAGR, 2019→2024 | −2.5%/yr | −2.0%/yr | SFO, slightly |
| 2024 enplanements | 37.76M | 25.08M | |
| Recovery vs. 2019 | 87.9% | 90.3% | SFO |

## What this means

- **LAX wins mainly on scale.** It handles far more flights and passengers, and a larger share of its seats are international. International traffic tends to carry higher margins, partly because only airports with customs facilities can serve it.
- **Demand pressure is about the same at both.** Planes are roughly 82% full at each airport. That is near the 80–85% level where airlines start turning away peak-day passengers, but neither airport stands out.
- **Neither airport is growing.** Both still had fewer passengers in 2024 than in 2019. SFO has recovered somewhat better, but this weakens the case for adding capacity at either one.

## Limits of this comparison

1. **The scoring exaggerates small gaps.** With only two airports, each category scores the better one 100 and the worse one 0. A 0.2-point load-factor difference therefore counts as much as a 40% difference in flights. The substance is "LAX is bigger and slightly more international; otherwise similar."
2. **The congestion measure ignores airfield capacity.** It counts departures but not how many flights each airport's runways can handle, because that capacity figure isn't freely published. A smaller airport could be closer to its limits than its flight count suggests.
3. **The score doesn't cover finances.** Construction costs, existing capital plans, gate availability and land constraints aren't included.

**Bottom line:** On these metrics LAX is the stronger candidate, mostly because of its size and international traffic. However, the two airports are closer than 80 vs. 20 suggests, and both are still below 2019 passenger levels. I can also score each airport against all U.S. airports, which shows how they rank nationally rather than only against each other.

### Turn 2
**User:** Why is the first one higher?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**LAX scores higher because it narrowly leads three of the four categories, and those three carry 80% of the weight.**

In a two-airport comparison, each category gives 100 points to the better airport and 0 to the other. The final score is the weighted sum:

| Category (weight) | Leader | LAX gets | SFO gets |
|---|---|---|---|
| Congestion (30%) | LAX (266,820 vs. 190,763 departures) | 30 | 0 |
| Unmet demand (30%) | LAX (81.9% vs. 81.7% load factor) | 30 | 0 |
| Long-haul share (20%) | LAX (30.8% vs. 28.3% international seats) | 20 | 0 |
| Growth (20%) | SFO (−2.0% vs. −2.5%/yr CAGR) | 0 | 20 |
| **Total** | | **80** | **20** |

**Only one of LAX's leads is large.** LAX handles about 40% more departures, which is a real difference. Its other two leads are small:

- **Load factor:** a 0.2-point gap, which is effectively a tie but still earns LAX the full 30 points.
- **International share:** a 2.5-point gap, which is modest but earns LAX the full 20 points.

SFO earns its 20 points only because its passenger numbers are declining slightly more slowly than LAX's.

Without the all-or-nothing effect, the honest takeaway is that **LAX's advantage comes mainly from its much larger flight volume**, with a slight edge in international traffic. On demand pressure and growth, the two airports are close.

To see the gap on a more proportional scale, I can score each airport against all U.S. airports.
