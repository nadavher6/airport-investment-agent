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

**BOS has fully recovered and is now above pre-COVID traffic: 21,090,721 enplanements in CY2024, a record for the 2015–2024 series.**

### Key evidence
- **Recovery:** CY2024 traffic is 1.0189× the CY2019 level (20,699,377), so about 1.9% above pre-pandemic.
- **Momentum:** Up 5.65% year over year from 19,962,678 in CY2023.
- **Long-run growth:** About 2.91% per year from 2015 to 2024. This is 9 periods, so it is not a true 10-year CAGR.
- **Recent growth is slow:** Only about 0.38% per year from 2019 to 2024, because most of that window was spent climbing back from the 2020 low (6,035,452).
- **Rank:** It is a Large hub, ranked #16 nationally, the same as in 2019 (it dipped to #19 in 2020–2021).

### Caveat
This covers FAA enplanements only (CY2015–CY2024). It doesn't show congestion, load factor or international mix.

I can score BOS on those factors, or compare it with peers such as JFK or EWR, if useful.

### Turn 2
**User:** And its long-haul share?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["BOS"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"BOS","name":"General Edward Lawrence Logan International","score":74.5,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: …

**Agent answer:**

**About 22.1% of BOS seats are international, which gives it a long-haul sub-score of 44.2 out of 100.**

### Key evidence
- **International seats:** 5,712,061 of 25,901,626 total seats in the latest 12 months (BTS T-100) were on international flights.
- **How it's scored:** The share is measured against a 50% benchmark, where 50% international = 100. So 22.1% scores 44.2.
- **Why it matters:** International traffic tends to be higher-margin. It brings weight-based landing fees and depends on customs/FIS facilities that competitors can't easily copy.

### Caveats
- This is an absolute score against all U.S. airports, not a comparison with peers.
- "International share" is a proxy for long-haul. It counts all international seats, including short hops to Canada and the Caribbean, so true long-haul exposure may be somewhat lower.

I can also break down BOS's congestion, load factor or overall investment score. I can also compare its international share with JFK or EWR, if useful.
