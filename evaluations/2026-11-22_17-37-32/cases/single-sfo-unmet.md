# single-sfo-unmet

- **Group:** G4-single
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
          "SFO"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Explains unmet demand via load factor",
    "Notes it is a proxy"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** What is the unmet demand at SFO and why?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["SFO"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":89.5,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

# Unmet Demand at SFO

**Unmet-demand sub-score: 98.9 / 100** (absolute, against all U.S. airports). That makes it one of the strongest signals in SFO's overall Investment Attractiveness Score of **89.5**.

## The number behind it: load factor

The score uses **load factor**, which is passengers divided by seats. Figures are from BTS T-100 for the latest 12 months.

| Input | Value |
|---|---|
| Passengers | 26,498,215 |
| Seats offered | 32,451,463 |
| **Load factor** | **81.7%** |

## Why it scores so high

- **Planes are running full.** On average, 81.7% of seats were filled. That is an annual average, so peak days and peak banks are likely fuller.
- **Full planes turn passengers away.** Above roughly 80–85%, airlines start "spilling" demand. Travelers who want a given flight can't get a seat, or can't get one at a reasonable fare. SFO is at the threshold where this becomes material.
- **This suggests demand exceeds capacity.** If more gate, runway or terminal capacity let airlines add flights or larger aircraft, there appears to be passenger demand to fill them.

## A tension worth noting

The growth component (sub-score 49.2) points the other way:

- Enplanements fell about **2.0% per year** from 2019 to 2024.
- 2024 traffic was only **90.3% of 2019 levels** (25.08M enplanements in 2024).

So SFO has *fewer* passengers than before COVID, yet its planes are *fuller*. One plausible reading is that airlines cut seats faster than demand fell, leaving the remaining flights tightly packed. That would mean the spilled demand reflects how much capacity airlines chose to offer, not only physical limits. The data shows the pattern, but it can't confirm the cause.

## Data limits and assumptions

- **Load factor is a proxy.** It measures how full planes are, not directly how many travelers were turned away. True spilled demand isn't published.
- **It is an annual average.** It hides seasonal and time-of-day peaks, where the real constraint usually sits.
- **The two sources don't align exactly.** T-100 passengers (26.5M, latest 12 months) and FAA enplanements (25.1M, calendar year 2024) cover different periods and count differently, so the figures won't match.
- **Capacity constraints aren't measured.** The score doesn't capture runway limits, such as SFO's closely spaced parallel runways during low visibility. These may also limit capacity.

**Bottom line:** By the load-factor measure, SFO shows very strong unmet demand. The weak post-2019 recovery is something to dig into before treating it as a clear expansion case.
