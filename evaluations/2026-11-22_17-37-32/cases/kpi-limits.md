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

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

The Investment Attractiveness Score is a useful screening tool, but it has important limits. Here's what it measures, where it falls short, and how to use it.

## What the score is

A deterministic 0–100 score built from four categories, using FAA enplanement data and BTS T-100 traffic data:
1. **Congestion**, measured by aircraft operations
2. **Unmet demand**, measured by load factor (how full flights are)
3. **Long-haul share**, measured by international seats
4. **Growth**, measured by compound annual growth in enplanements

## Limitations

### 1. Relative vs. absolute scoring
- **With 2+ airports, scores are relative to that set only.** A 100 means "best of the airports you compared," not "a great investment." If you compare three weak airports, one still scores 100.
- Scores from different comparison runs can't be compared with each other. Only a single-airport query scores against all U.S. airports.

### 2. Demand indicators only, no profitability
The score measures pressure on capacity. It does not model returns. It ignores:
- **Construction and expansion costs**, including land, terrain, and environmental constraints
- **Airport finances**: debt, bond ratings, passenger facility charges, and rates and charges agreements with airlines
- **Non-aeronautical revenue** such as parking, concessions, and real estate, which often drives airport profitability
- **Ownership and governance.** Most U.S. airports are publicly owned, so how a private investor could participate varies widely.

### 3. Proxy measures can mislead
- **Operations count** reflects congestion but not runway, gate, or terminal capacity. A busy airport may already have spare capacity.
- **Load factor** suggests unmet demand, but high load factors can also reflect airline capacity discipline rather than true pent-up demand.
- **International seats** stand in for "long-haul" but miss long domestic routes and the economics of specific routes.

### 4. Historical, backward-looking data
- Enplanement data covers CY2015–CY2024 only, so recent shifts are not reflected.
- **5-year CAGR (2019→2024)** includes the COVID collapse and recovery, which can distort growth rates. Airports that recovered fast may look stronger than their underlying trend.
- **The "10-year" CAGR actually covers 9 periods (2015→2024)**, so it is not a true 10-year rate.
- Past growth doesn't guarantee future growth.

### 5. Missing external factors
The score does not capture:
- Airline hub strategy. A single carrier's hub decision can change an airport's traffic dramatically.
- Competition from nearby airports in the same metro.
- Regional economic and population forecasts.
- Regulatory, political, community, and noise constraints on expansion.
- Ground access, such as roads and transit.
- Cargo activity, which can be a major revenue source at some airports.

### 6. Data coverage gaps
- Some airports may lack data for a category. The output flags this with `coverage` and `missing` fields, and a score built on partial data is less reliable.
- Only 3-letter FAA/IATA codes work. Smaller non-primary airports may have thin or no data.

### 7. Fixed weighting
The category weights are fixed and not customizable. Your strategy may prioritize differently. A growth-focused investor, for example, might weight growth far more heavily than international share.

## How to use it well
- Use it as a **first-pass screen** to shortlist candidates, not as an investment decision.
- Look at the **sub-scores and evidence**, not just the final number. Two airports can reach the same score for very different reasons.
- **Compare meaningful peer sets**, such as airports in the same hub class or the same region.
- Check for **missing-data flags** before trusting a ranking.
- Follow up with financial, engineering, and market due diligence.

If you'd like, I can run the score on a set of airports and walk through what the sub-scores do and don't tell you.
