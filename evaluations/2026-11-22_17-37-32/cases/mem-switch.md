# mem-switch

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 switches focus to MIA",
    "Doesn't keep answering about LAX/SFO"
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

**Relative score:** LAX **80**, SFO **20**. Both airports have complete data in all four categories.

**Important caveat:** With only two airports, the tool scores each category on a min-max scale, so the better airport gets 100 and the other gets 0. As a result, **80 vs. 20 greatly overstates the gap.** On most measures the two are close.

## Category breakdown

| Category (weight) | LAX | SFO | Real gap |
|---|---|---|---|
| **Congestion** (30%): annual departures | 266,820 | 190,763 | **Large.** LAX has about 40% more flights. |
| **Unmet demand** (30%): load factor | 81.9% | 81.7% | **Negligible** (0.2 points) |
| **Long-haul share** (20%): international seats | 30.8% | 28.3% | **Modest** (2.5 points) |
| **Growth** (20%): 5-year enplanement CAGR, 2019→2024 | −2.5%/yr | −2.0%/yr | **Small.** Both are shrinking. |
| **Recovery vs. 2019** | 88% | 90% | Small |
| **2024 enplanements** | 37.8M | 25.1M | LAX is about 50% larger |

## What this means

- **LAX's clearest advantage is scale and congestion.** It handles far more operations, and a busier airfield usually gets more value from added capacity. Its slightly higher international share also points to more high-margin traffic.
- **Planes are about equally full at both airports.** Both are near the 80–85% range where some peak demand starts getting turned away. This supports capacity investment at either airport, but it doesn't separate them.
- **Neither has recovered to 2019 passenger levels.** Both are still 10–12% below 2019, with negative 5-year growth. SFO is recovering slightly faster. Investors should treat growth as the weak point for both.

## Data limits

- **Congestion is measured by flight count, not utilization.** The ideal measure is operations ÷ annual service volume (the airfield's practical capacity), but that capacity figure isn't published. A busy airport with ample runway room could therefore look more congested than it is.
- **Different time windows.** Departures, load factor and international share come from the latest 12 months of BTS T-100 data. Growth comes from FAA calendar-year enplanements for 2019–2024.
- **Demand only.** The score doesn't include construction costs, land constraints, regulation or airline lease terms. These matter a lot at both airports.

**Bottom line:** LAX ranks ahead, mainly because of its much larger traffic volume and modestly higher international share. SFO is close on everything else. If it would help, I can score each airport against all U.S. airports, which gives a more meaningful sense of how strong each one is.

### Turn 2
**User:** Actually, let's look at Miami instead.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Miami"]})`, `score_airports({"airport_codes":["MIA","FLL","PBI"]})`
  - find_airports_by_city → ok: {"results":{"Miami":{"matchedAs":"metro","airports":[{"code":"MIA","name":"Miami International","city":"Miami","state":"FL","hubType":"L","latestEnplanements":26588002,"secondary":false},{"code":"FLL","name":"Fort Lauderdale/Hollywood International","city":"Fort Lauderdale","state":"FL","hubType":"L","latestEnplanements":17096131,"secondary":false},{"code":"PBI","name":"Palm Beach International","…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"MIA","name":"Miami International","score":100,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","input…

**Agent answer:**

# Miami Area Airports: Investment Attractiveness

I looked at the three airports that serve the Miami metro: **Miami International (MIA)**, **Fort Lauderdale/Hollywood (FLL)** and **Palm Beach (PBI)**.

**Relative scores:** MIA **100**, PBI **84.6**, FLL **0**.

These scores need two caveats:

1. **PBI's 84.6 is based on growth only.** The data has no BTS T-100 record for PBI, so congestion, load factor and international share are missing. Its coverage is 20%. Treat its score as a growth reading, not a full assessment.
2. **The scale exaggerates gaps.** Each category is scaled so the best airport gets 100 and the worst gets 0. In three of the four categories only MIA and FLL have data, so the ranking is mostly a two-airport contest, and FLL's 0 means "last here," not "unattractive."

## Category breakdown

| Category (weight) | MIA | FLL | PBI | Real gap (MIA vs. FLL) |
|---|---|---|---|---|
| **Congestion** (30%): departures, latest 12 months | 220,368 | 116,709 | no data | **Large.** MIA has about 89% more flights. |
| **Unmet demand** (30%): load factor | 81.0% | 79.6% | no data | **Small** (1.4 points) |
| **Long-haul share** (20%): international seats | 44.7% | 17.5% | no data | **Very large** (27 points) |
| **Growth** (20%): 5-year CAGR, 2019→2024 | +4.4%/yr | −1.0%/yr | +3.6%/yr | **Large** |
| **Recovery vs. 2019** | 124% | 95% | 119% | |
| **2024 enplanements** | 26.6M | 17.1M | 4.1M | |

## What this means

- **MIA is the clear standout.** It leads in every category where it can be compared. Its international share is the main differentiator: almost 45% of seats are international. That traffic is high-margin and protected by customs and border facilities that competitors can't easily copy. Traffic is also well above 2019 levels.
- **FLL's case is mainly unmet demand.** Its planes are nearly as full as MIA's, but it carries far less international traffic and is still about 5% below 2019 passenger levels.
- **PBI shows strong growth but needs more data.** Passengers have risen 19% since 2019. However, we can't assess its congestion, load factor or international mix, so it's a lead to investigate, not a conclusion.

## Compared with LAX and SFO

The scores from the two comparisons can't be compared, because each set was scaled against itself. The raw numbers can be compared, though. MIA's load factor (81.0%) is about the same as LAX's (81.9%). MIA is far ahead on international share (44.7% vs. 30.8%) and growth (+4.4%/yr vs. −2.5%/yr). LAX is busier, with 266,820 departures to MIA's 220,368.

## Data limits

- **Congestion is measured by flight count, not utilization.** Runway capacity figures aren't published, so a busy airport with spare runway room could look more congested than it is.
- **Different time windows.** Departures, load factor and international share use the latest 12 months of BTS data. Growth uses FAA calendar-year data for 2019–2024.
- **Demand only.** The score doesn't include construction costs, land constraints, regulation or airline lease terms.

I can score MIA, FLL and PBI individually against all U.S. airports. That avoids the min-max distortion and gives a fairer comparison with LAX and SFO.
