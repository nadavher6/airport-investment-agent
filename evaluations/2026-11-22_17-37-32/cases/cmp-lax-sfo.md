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

**Headline:** LAX scores **80** and SFO scores **20** on the relative Investment Attractiveness Score. However, the two airports are much closer than that gap suggests.

## Why the gap overstates the difference

With only two airports, the relative score rescales each category so the better airport gets 100 and the worse gets 0. Even tiny differences therefore become maximal:

| Category (weight) | LAX | SFO | Real gap | Points to |
|---|---|---|---|---|
| Congestion: departures (30%) | 266,820 | 190,763 | **~40% more at LAX**, meaningful | LAX +30 |
| Unmet demand: load factor (30%) | 81.9% | 81.7% | **0.2 pts**, negligible | LAX +30 |
| Long-haul: international seat share (20%) | 30.8% | 28.3% | 2.5 pts, modest | LAX +20 |
| Growth: 5-yr enplanement CAGR (20%) | −2.5%/yr | −2.0%/yr | 0.5 pts, small | SFO +20 |

Only the congestion category reflects a large real difference. The load-factor result, worth 30 points, is effectively a tie.

## What the data says

**LAX's advantages:**
- It is the larger operation: about 37.8M enplanements in 2024 vs. about 25.1M at SFO.
- It has roughly 40% more departures.
- It has a slightly higher international share. International traffic is high-margin because of weight-based landing fees and the barrier to entry created by customs and border facilities.

**Shared strengths:**
- Both run planes about 82% full. That is near the 80–85% range where peak-day demand starts getting turned away, which supports adding capacity at either airport.

**Shared weakness:**
- Neither has recovered to 2019 traffic levels. LAX is at 88% of 2019 enplanements and SFO is at 90%.
- Both shrank over 2019–2024, so the "growth" category only rewards SFO for shrinking less.
- This is the biggest caution for expansion at either airport. The investment case rests on existing pressure and high-margin traffic mix, not on demonstrated growth momentum.

## Assumptions and data limits

- **Congestion is measured by raw departure volume, not capacity utilization.** True utilization would be operations divided by annual service volume (ASV), and ASV isn't freely published. An airport with fewer flights but tighter runway or gate limits could be more constrained than this proxy shows. Treat the congestion result as "LAX is busier," not "LAX is more capacity-constrained."
- Operations and traffic-mix data are BTS T-100 figures for the latest 12 months. Growth data comes from FAA enplanements for 2019–2024.
- The score doesn't capture costs, regulatory or environmental constraints, airline lease terms, or project-specific economics.

## Bottom line

LAX comes out ahead, mainly on scale, airfield activity, and a somewhat larger international share. SFO's only edge is a slightly better recovery. Since the scoring exaggerates the gap, I'd call this a moderate LAX lead rather than a decisive one.

**Possible next steps:**
- Score each airport on its own to see how both rank against all U.S. airports.
- Pull detailed enplanement trends for both.
- Add other West Coast airports to the comparison for a broader peer set.
