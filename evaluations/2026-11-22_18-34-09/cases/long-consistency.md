# long-consistency

- **Group:** G12-long
- **Turns:** 5

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Final turn's BOS figure matches the first turn's",
    "Stays grounded across all turns",
    "No contradictions"
  ],
  "mustNot": [
    "Re-estimate a different BOS number",
    "Lose track of earlier airports"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** How is BOS doing on passenger traffic?

- **Classified as:** in_scope
- **Tools called:** `get_enplanements({"airport_code":"BOS"})`
  - get_enplanements → ok: {"airportCode":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","series":[{"year":2015,"enplanements":16290362,"rank":17,"hubType":"L"},{"year":2016,"enplanements":17759044,"rank":17,"hubType":"L"},{"year":2017,"enplanements":18759742,"rank":16,"hubType":"L"},{"year":2018,"enplanements":20006521,"rank":16,"hubType":"L"},{"year":2019,"enplanement…

**Agent answer:**

**BOS has fully recovered from COVID and hit a record in CY2024: 21,090,721 enplanements, up 5.65% from CY2023.**

### Key evidence
- **Recovery:** CY2024 traffic is 1.019× the CY2019 level, so Boston is now about 1.9% above its pre-pandemic peak of 20,699,377.
- **Rank:** It is #16 nationally as a Large hub. That matches its 2019 rank. It slipped to #19 in 2020–2021.
- **Momentum:** Growth from 2022 to 2024 was strong: 17.4M → 20.0M → 21.1M.
- **Long-run trend:**
  - Growth from CY2015 to CY2024 was 2.91% per year. This covers 9 periods, so it isn't a true 10-year rate.
  - Growth from CY2019 to CY2024 was only 0.38% per year, because the 2020 collapse to about 6.0M wiped out most of that window's gains.

### Caveat
This is FAA boarding data only. It doesn't show how full the planes are, how much of the traffic is international, or how congested the airfield is.

I can score BOS on those factors, or compare it with other Northeast airports, if that's useful.

### Turn 2
**User:** And what about ATL?

- **Classified as:** in_scope
- **Tools called:** `get_enplanements({"airport_code":"ATL"})`
  - get_enplanements → ok: {"airportCode":"ATL","name":"Hartsfield/Jackson Atlanta International","city":"Atlanta","state":"GA","hubType":"L","series":[{"year":2015,"enplanements":49340732,"rank":1,"hubType":"L"},{"year":2016,"enplanements":50501858,"rank":1,"hubType":"L"},{"year":2017,"enplanements":50251964,"rank":1,"hubType":"L"},{"year":2018,"enplanements":51865797,"rank":1,"hubType":"L"},{"year":2019,"enplanements":535…

**Agent answer:**

**ATL is still the busiest U.S. airport, with 52,511,402 enplanements in CY2024, up 3.06% from CY2023. It has not quite returned to its pre-COVID level.**

### Key evidence
- **Recovery:** CY2024 traffic is 0.981× the CY2019 level. That leaves Atlanta about 1.9% below its CY2019 peak of 53,505,795.
- **Rank:** ATL was #1 nationally as a Large hub in every year from 2015 to 2024, including 2020.
- **Momentum:** Growth is slowing. Traffic went from 45.4M in 2022 to 51.0M in 2023 (about +12%), then to 52.5M in 2024 (+3.06%).
- **Long-run trend:**
  - Growth from CY2015 to CY2024 was 0.69% per year. This covers 9 periods, so it isn't a true 10-year rate.
  - Growth from CY2019 to CY2024 was −0.37% per year, because ATL is still slightly below its 2019 level.

### Versus BOS
BOS has passed its 2019 level (1.019×) and grew faster in CY2024 (5.65% vs 3.06%). ATL is more than twice BOS's size but is growing more slowly from a much larger base.

### Caveat
This is FAA boarding data only. It doesn't cover load factor, international share or airfield congestion, which matter for expansion decisions.

I can score ATL and BOS head-to-head for investment potential if that's useful.

### Turn 3
**User:** Compare LAX and SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX leads SFO by 11.1 points (66.9 vs 55.8).**

### Why
- **Congestion:** LAX had 266,820 departures in the latest 12 months against SFO's 190,763. LAX takes the full congestion contribution (30 points) and SFO gets none. This is the main reason LAX leads.
- **Long-haul:** 30.8% of LAX seats are international against 28.3% at SFO. That gives LAX a small edge in this high-margin traffic.
- **Unmet demand:** This category is effectively a tie. Planes ran 81.9% full at LAX and 81.7% at SFO, both near the ~80–85% range where peak-day demand starts being turned away.

### Trade-offs
- **Growth** is SFO's category and is worth its full 20 points. Neither airport is actually growing, though. SFO shrank -2.0% per year from CY2019 to CY2024 and LAX shrank -2.5% per year. SFO wins only because it declined less.

### How to read this
- **Relative scoring:** The airports are scored against each other. For congestion and growth, 100 means the better of these two, not the best in the U.S. This exaggerates the gaps: SFO scores 0 on congestion even though it is a very busy airfield. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Coverage:** Coverage is 1 for both airports, so no category is missing.
- **Data windows:** Departures, load factor and international share come from BTS T-100 for the latest 12 months. Growth uses FAA enplanements from CY2019 to CY2024.
- **Congestion proxy:** Congestion is measured by departure volume, not departures relative to airfield capacity. SFO's tight runway layout may make it more capacity-constrained than this score suggests.

```compare
{
  "columns": ["LAX", "SFO"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busiest airfield of the pair, with a larger international seat share" }], [{ "kind": "markdown", "text": "Smaller traffic decline since CY2019; planes about as full as LAX's" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Steepest decline since CY2019 of the pair" }], [{ "kind": "markdown", "text": "Still below CY2019 traffic; volume-based congestion proxy may understate its constraints" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "International terminal and gate capacity" }], [{ "kind": "markdown", "text": "Modernization and efficiency upgrades as traffic recovers" }]] }
  ]
}
```

If LAX's traffic recovers faster than SFO's, the gap would widen. A capacity-adjusted congestion measure (operations ÷ ASV) could narrow it in SFO's favor.

### Turn 4
**User:** Which of those two grew more?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**Neither grew. SFO declined less than LAX from CY2019 to CY2024: -2.0% per year at SFO versus -2.5% per year at LAX.**

- **SFO** shrank about 2.0% per year over the five years.
- **LAX** shrank about 2.5% per year, the steeper decline of the two.

Both airports are still below their CY2019 traffic. That is why SFO's growth win in the score reflects a smaller decline, not real growth.

These are compound annual rates from FAA enplanements over the CY2019→CY2024 window. Because that window includes the 2020 collapse, it doesn't show which airport is recovering faster right now. I can pull each airport's latest year-over-year change and recovery ratio if that's useful.

### Turn 5
**User:** Remind me BOS's enplanement number again.

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

**BOS had 21,090,721 enplanements in CY2024**, from the FAA data pulled earlier in this conversation.

- That is up 5.65% from CY2023.
- It is 1.019× its CY2019 level of 20,699,377, so Boston is about 1.9% above its pre-pandemic peak.
- It ranks #16 nationally as a Large hub.

I can compare BOS's traffic with LAX, SFO or ATL, or score it for investment potential.
