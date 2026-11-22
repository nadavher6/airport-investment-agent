# mem-it

- **Group:** G9-memory
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 2 resolves 'its' to BOS",
    "Answers BOS long-haul share without re-asking"
  ],
  "mustNot": [
    "Ask which airport"
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

# Boston Logan (BOS) Passenger Traffic

**BOS has fully recovered from COVID and reached a new record in 2024, but its growth since 2019 has been slow.**

## Key figures (FAA enplanement data, CY2024)

| Metric | Value |
|---|---|
| 2024 enplanements | **21,090,721** (all-time high in the 2015–2024 series) |
| Hub type | Large hub |
| National rank | **#16** |
| Year-over-year change | **+5.65%** (from 19,962,678 in 2023) |
| Recovery vs. 2019 | **1.019**, about 1.9% above pre-pandemic |
| 5-year CAGR (2019→2024) | **0.38%/yr** |
| 9-period CAGR (2015→2024) | **2.91%/yr** |

## The trend

- **Before COVID (2015–2019), growth was strong.** Traffic rose from 16.29M to 20.70M. I calculated that as about 6.2% per year from the tool's yearly figures.
- **2020 brought a collapse.** Traffic fell to 6.04M, down about 71%, and the rank slipped to #19.
- **Recovery was steady.** Traffic reached 10.91M in 2021, 17.44M in 2022 and 19.96M in 2023. In 2024 it passed the 2019 peak, and the rank returned to #16.

## What it means for investment

- **Demand has recovered.** Traffic is at a record and still rising, with growth above 5% last year.
- **Net growth since 2019 is small.** The 0.38% five-year CAGR shows BOS has mostly regained lost ground rather than expanded. Its pre-COVID growth rate has not returned yet.
- **The rank has not changed.** BOS held #16 nationally, so it is keeping pace with peers rather than gaining share.

## Data limits

- These figures count only boarding passengers. They say nothing about congestion, load factors or international share, which also matter for deciding whether expansion would pay off.
- The "10-year" CAGR actually covers 9 periods (2015→2024).
- The data runs through CY2024 only.

To see whether BOS is a strong expansion candidate, I can run the **Investment Attractiveness Score**. I could score BOS alone against all U.S. airports, or compare it with other airports such as JFK, EWR, PHL or other New England airports. Would you like me to do that?

### Turn 2
**User:** And its long-haul share?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["BOS"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"BOS","name":"General Edward Lawrence Logan International","score":91.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: …

**Agent answer:**

# Boston Logan (BOS): Long-Haul Share

**BOS has a high international share. About 22% of its seats are on international flights, which earns it the maximum score in this category.**

## Key figures (BTS T-100, latest 12 months)

| Metric | Value |
|---|---|
| International seats | **5,712,061** |
| Total seats | **25,901,626** |
| **International share** | **22.1%** |
| Long-haul sub-score (vs. all U.S. airports) | **100 / 100** |
| Contribution to overall score | **20 of a possible 20 points** |

This was an absolute score, so BOS was measured against all U.S. airports rather than a peer group. A sub-score of 100 means it reaches the top of the scale for this metric. It does not necessarily mean BOS is the single highest airport in the country.

## Why it matters for investment

- **International traffic tends to earn more per passenger.** Widebody aircraft pay higher weight-based landing fees, and international passengers often spend more in the terminal.
- **Customs facilities protect the airport's position.** International service needs federal customs and border facilities, and nearby airports cannot easily add them. That makes BOS's international base hard for competitors to take away.
- **It strengthens the case for expansion.** International demand is a common reason to invest in widebody gates, customs capacity and terminal space.

## The overall score

The same run gave BOS an overall **Investment Attractiveness Score of 91.1/100**, with data in all four categories:

| Category | Sub-score | Contribution |
|---|---|---|
| Congestion (190,698 departures) | 100 | 30.0 |
| Unmet demand (81% load factor) | 97.6 | 29.3 |
| Long-haul share (22.1% international) | 100 | 20.0 |
| Growth (0.38%/yr 5-yr CAGR) | 59.1 | 11.8 |

Growth is the one weak category, which matches the slow 2019–2024 trend we discussed earlier. The other three categories all point to an airport under capacity pressure with valuable traffic.

## Data limits

- **This measures international flights, not true long-haul flights.** International seats include short trips to Canada and the Caribbean. The data does not separate transatlantic widebody service, so the share of genuinely long flights is likely lower than 22.1%.
- **The time periods differ.** Seat data covers the latest 12 months of BTS T-100. The enplanement figures are FAA calendar-year 2024.
- **The congestion score is a proxy.** It uses departure volume because annual service volume, the true capacity measure, is not published.

Would you like me to compare BOS's international share and overall score with peers such as **JFK, EWR, PHL or IAD**? A side-by-side comparison would show whether its international position stands out among East Coast gateways.
