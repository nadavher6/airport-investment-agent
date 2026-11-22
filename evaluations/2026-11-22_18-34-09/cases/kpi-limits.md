# kpi-limits

- **Group:** G8-method
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Names proxies (congestion=operations volume, unmet=load factor)",
    "Mentions assumptions / weights / coverage"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** What are the limitations of your investment score?

- **Classified as:** grading
- **Tools called:** (none)

**Agent answer:**

The score is a **proxy-based, data-limited screen**, useful for shortlisting airports but not a full investment case.

### What each category can't see
- **Congestion uses traffic volume, not true capacity.** The ideal measure is flights ÷ what the runways can handle, but runway capacity (ASV) isn't freely published. Annual departures stand in for it, so a busy airport with ample runway room can look "congested" and a smaller airport near its limits can look underused.
- **Unmet demand uses load factor, not real spill.** Knowing how many travelers were turned away requires booking data. Average load factor only hints at sold-out peak flights.
- **Long-haul share counts international seats, not route value.** A short international hop and a widebody flight to Asia count the same. The share is capped at 50%, so above that airports aren't differentiated.
- **Growth is one fixed window (CY2019→CY2024).** It mixes COVID recovery with underlying trend, and it's missing for any airport without a CY2019 or CY2024 figure.

### How the method affects results
- **Relative vs. absolute mode.** With 2+ airports, congestion and growth are scaled to the best of *that set*, so adding or removing an airport can shift scores. With one airport, it's scored against all US airports. Scores from different comparisons aren't directly comparable.
- **Winsorizing at the 5th/95th percentile** keeps outliers from distorting the scale, but it flattens differences at the extremes.
- **Missing data is reweighted, not penalized.** If a category has no data, the remaining weights are scaled up. Always check `coverage` and `missing`, because a score built on three categories isn't equivalent to one built on four.
- **The weights are a judgment call** (30/30/20/20, need vs. quality). Different priorities would produce different rankings.

### What it doesn't cover at all
These aren't graded: construction cost, land and physical constraints, financing, airline or hub strategy, competition from nearby airports, regulation, and revenue or margin data. The data is also backward-looking: FAA CY2024 enplanements and the latest 12 months of BTS T-100.

If useful, I can score specific airports and point out where these limits matter for them.
