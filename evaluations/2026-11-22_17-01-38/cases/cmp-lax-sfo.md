# cmp-lax-sfo

- **Group:** G6-compare
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "score_airports",
      "inputContains": {
        "airport_codes": [
          "LAX",
          "SFO"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Names which ranks higher",
    "Cites sub-scores / evidence for both"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare LAX and SFO for investment.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# LAX vs. SFO: Investment Comparison

**Relative score: LAX 80, SFO 20**

## Important caveat first

With only two airports, the score ranks them **relative to each other**. In each category the better airport gets 100 and the other gets 0, even when the gap is tiny. So the 80 vs. 20 result **makes the difference look much larger than it is**. The two airports are actually close on most measures.

## Category breakdown

| Category (weight) | LAX | SFO | How close? |
|---|---|---|---|
| **Congestion** (30%) | 266,820 departures | 190,763 departures | **Real gap.** LAX has about 40% more flights |
| **Unmet demand / load factor** (30%) | 81.9% | 81.7% | **Almost tied.** Only 0.2 points apart |
| **Long-haul / international share** (20%) | 30.8% of seats | 28.3% of seats | Small gap, LAX slightly ahead |
| **Growth, 2019→2024 CAGR** (20%) | −2.5%/yr (88% of 2019 traffic) | −2.0%/yr (90% of 2019 traffic) | Both shrinking; SFO slightly less so |

## What this means

- **LAX has the stronger case for adding capacity.** It is much busier (266,820 departures) and has a slightly higher international share, which brings higher-margin traffic. That volume is its one clear advantage.
- **Demand pressure is about the same at both.** Planes are roughly 82% full at each airport. That is near the point (about 80–85%) where airlines start turning away passengers on peak days. Neither airport stands out here.
- **Growth is a warning sign for both.** Neither has returned to its 2019 passenger levels. LAX is at about 88% and SFO at about 90%. Money spent on modernization (better terminals, faster processing, more international gates) may pay off sooner than money spent on raw expansion until traffic recovers.

## Data limits

- "Congestion" is measured by flight volume, not by how close each airfield is to its maximum capacity. That capacity figure isn't publicly available, so the scoring tool can't use it. SFO's runways are known to be tightly constrained, and this measure may undercount that.
- Flight and seat data cover the latest 12 months (BTS T-100). Passenger growth uses 2019–2024 FAA enplanement data.
- The score shows operational pressure only. It does not include costs, airline agreements, land, or regulations.

**Suggested next step:** I can score each airport against all U.S. airports. That would show whether both rank highly nationally, which is likely, rather than whether one simply beats the other. I could also add another California airport, such as SAN, OAK, or SJC, for a broader comparison.
