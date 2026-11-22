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

# Limitations of the Investment Attractiveness Score

The score is a **screening tool, not an investment decision**. It shows where demand pressure and growth look strongest in public FAA and BTS data. It does not tell you whether a specific project will make money.

## 1. What it measures (and what it leaves out)

The score is a weighted blend of four signals:
- **Congestion**: aircraft operations
- **Unmet demand**: load factor
- **Long-haul share**: international seats
- **Growth**: enplanement CAGR

It does **not** capture many things that drive real profitability:
- **Physical constraints**: runway, gate, terminal and airspace capacity, or available land. High congestion may mean "needs expansion" or "can't expand."
- **Costs**: construction costs, existing debt, and cost per enplanement charged to airlines.
- **Revenue mix**: parking, concessions, rental cars, cargo and real estate are often a large share of airport income.
- **Governance and finance**: most U.S. airports are publicly owned. Private returns depend on deal structure (P3s, concessions, terminal leases), bond covenants and FAA grant rules.
- **Airline dynamics**: hub concentration, the risk of a dominant carrier leaving, and use-and-lease agreements.
- **Competition**: nearby alternative airports that can absorb demand.
- **Projects already underway**: an airport with strong signals may already be mid-expansion.

## 2. Relative vs. absolute scoring

- When you score **2 or more airports**, the results are **relative to that set**. A 100 means "best of this group," not "excellent." Adding or removing one airport can change everyone's scores.
- When you score **one airport**, it is compared against all U.S. airports.
- Scores from different runs are not comparable unless the sets match.

## 3. Data limits

- **Enplanement history covers CY2015 to CY2024 only.** Nothing newer is included.
- **COVID distorts growth.** The 5-year CAGR (2019 to 2024) partly measures recovery, not underlying growth. Check the `recoveryVs2019` ratio alongside it.
- **The "10-year" CAGR is really 9 periods** (2015 to 2024).
- **Coverage gaps:** some airports, especially small or non-primary ones, may lack data for certain categories. The output lists these under `coverage`/`missing`, and gaps can push a score up or down.
- **Backward-looking:** it uses historical traffic, not forecasts, planned airline service or regional economic outlooks.

## 4. Built-in assumptions

- **Fixed weights.** Your thesis might weight things differently, such as cargo or domestic connections.
- **High load factor is treated as unmet demand.** It can also reflect airlines deliberately limiting capacity.
- **International seats are treated as valuable.** That suits long-haul gateways but not every investment strategy.
- **Airport-level view only.** It doesn't distinguish terminals or concourses, though many investments happen at that level.

## How to use it well

1. Use it to **shortlist**, then check the per-category evidence to see *why* an airport ranks high.
2. Compare airports of similar size (by hub type) so relative scores are meaningful.
3. Validate shortlisted airports with capital plans, capacity studies, airline agreements and financial statements before drawing conclusions.

I can score a specific set of airports and walk through the evidence behind each ranking if that would help.
