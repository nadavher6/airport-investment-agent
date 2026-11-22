# single-bos-followup

- **Group:** G4-single
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 contrasts post-2019 CAGR with pre-COVID (2015→2019) growth using the same series",
    "Grounded in the already-fetched data"
  ],
  "mustNot": [
    "Invent figures",
    "Contradict turn 1"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** How has BOS passenger traffic changed since 2019?

- **Classified as:** in_scope
- **Tools called:** `get_enplanements({"airport_code":"BOS"})`
  - get_enplanements → ok: {"airportCode":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","series":[{"year":2015,"enplanements":16290362,"rank":17,"hubType":"L"},{"year":2016,"enplanements":17759044,"rank":17,"hubType":"L"},{"year":2017,"enplanements":18759742,"rank":16,"hubType":"L"},{"year":2018,"enplanements":20006521,"rank":16,"hubType":"L"},{"year":2019,"enplanement…

**Agent answer:**

# BOS Passenger Traffic Since 2019

**Boston Logan (BOS) has fully recovered from COVID and is now slightly above its 2019 level, but growth since 2019 has been very slow.**

## Year by year (FAA enplanements)

| Year | Enplanements | vs. 2019 | National Rank |
|---|---|---|---|
| 2019 | 20,699,377 | baseline | 16 |
| 2020 | 6,035,452 | −70.8% | 19 |
| 2021 | 10,909,817 | −47.3% | 19 |
| 2022 | 17,443,775 | −15.7% | 16 |
| 2023 | 19,962,678 | −3.6% | 16 |
| 2024 | 21,090,721 | **+1.9%** | 16 |

## Key takeaways

- **Recovery:** 2024 traffic is 1.019 times the 2019 level, about 391,000 more boardings.
- **Momentum:** 2024 grew 5.65% over 2023, so traffic is still rising.
- **Slow 5-year growth:** The 2019–2024 compound annual growth rate is only **0.38%/year**, because the pandemic wiped out most of those years.
- **Pre-pandemic pace was much faster:** From 2015 to 2019, traffic grew from 16.29M to 20.70M, about 6.2% per year (my calculation from the FAA series). The FAA's 2015–2024 rate is 2.91% per year, but that covers 9 periods, not a true 10 years.
- **Rank held steady:** BOS was #16 nationally in both 2019 and 2024, after dropping to #19 in 2020–21.

## Limits of this data

- Enplanements count passengers boarding at BOS only. Arrivals and connecting traffic aren't counted separately.
- The data runs through calendar year 2024. Nothing from 2025 onward is included.
- This doesn't show capacity limits, load factors or international mix.

For an investment view, I can run `score_airports` on BOS alone, which scores it against all U.S. airports. I could also compare it with other Northeast hubs like JFK, EWR and PHL.

### Turn 2
**User:** How does that compare to its growth before the pandemic?

- **Classified as:** in_scope
- **Tools called:** (none)

**Agent answer:**

# BOS Growth: Before vs. After the Pandemic

**Before COVID, Boston Logan grew about 16 times faster per year than it has since 2019.**

## Growth rates compared

| Period | Annual growth (CAGR) | Source |
|---|---|---|
| 2015 → 2019 (pre-pandemic) | **~6.17%/yr** | My calculation from FAA series |
| 2019 → 2024 (pandemic + recovery) | **0.38%/yr** | FAA `cagr5yr` |
| 2015 → 2024 (full span, 9 periods) | 2.91%/yr | FAA `cagr10yr` |

## Pre-pandemic year by year

| Year | Enplanements | YoY growth |
|---|---|---|
| 2015 | 16,290,362 | — |
| 2016 | 17,759,044 | +9.0% |
| 2017 | 18,759,742 | +5.6% |
| 2018 | 20,006,521 | +6.6% |
| 2019 | 20,699,377 | +3.5% |
| … | | |
| 2024 | 21,090,721 | +5.65% (vs. 2023) |

## What this means

- **Boston added about 4.4M boardings in the four years before COVID.** In the five years since 2019, it added only about 0.39M.
- **There is a "lost growth" gap.** If BOS had kept its 6.17% pace after 2019, 2024 would have reached about **27.9M** enplanements. Actual traffic was 21.1M, which is about **6.8M (≈24%) below that trend line**.
- **Current momentum looks like pre-pandemic growth again.** The 2024 gain of 5.65% falls within the 2016–2019 range. BOS passed its 2019 level in 2024, so this was real new growth and not just recovery.
- **Growth was already slowing before COVID.** The rate dropped to 3.5% in 2019, the weakest year of the pre-pandemic period. That could point to maturing demand or to capacity limits at a constrained airport.

## Caveats

- The "trend line" is a hypothetical straight-line projection, not a forecast. It assumes the 2015–2019 pace would have held, and the 2019 slowdown suggests it might not have.
- Enplanements show demand that was actually served. They can't tell whether the 2019 slowdown came from weaker demand or from limits on gates, runways or slots.
- The data runs only through CY2024.

To test whether capacity is the limit, I can run `score_airports` on BOS. It scores congestion (operations) and unmet demand (load factor) against all U.S. airports, which is the key question for an expansion investment.
