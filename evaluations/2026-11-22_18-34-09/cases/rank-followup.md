# rank-followup

- **Group:** G7-rank
- **Turns:** 2

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Turn 1 resolves West Coast and ranks the hubs",
    "Turn 2 explains the winner via its sub-scores without re-fetching"
  ],
  "mustNot": [
    "Invent figures",
    "Contradict turn 1"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank the West Coast large hubs for investment.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_region({"region":"West Coast"})`, `score_airports({"airport_codes":["LAX","SEA","SFO","SAN"]})`
  - find_airports_by_region → ok: {"region":"West Coast","matchedAs":"region","cities":["Seattle","Portland","San Francisco Bay Area","Los Angeles","San Diego"],"results":{"Seattle":{"matchedAs":"metro","airports":[{"code":"SEA","name":"Seattle-Tacoma International","city":"Seattle","state":"WA","hubType":"L","latestEnplanements":25414592,"secondary":false}]},"Portland":{"matchedAs":"metro","airports":[{"code":"PDX","name":"Portla…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SEA","name":"Seattle-Tacoma International","score":69.3,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":64.7,"contribution":19.4,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷…

**Agent answer:**

**SEA leads LAX by 2.4 points (69.3 vs 66.9).** SFO is third and SAN fourth. The four large hubs are SEA, LAX, SFO and SAN. PDX, SJC, OAK and the LA-area secondaries are medium or small hubs, so they are excluded.

- **#1 SEA (69.3):** SEA is the only large West Coast hub that combines a busy airfield with positive growth. Passengers grew 0.3% per year from CY2019 to CY2024, the best of the set, so SEA takes the full growth contribution. Its 212,841 departures give it a solid congestion score. The weak spot is long-haul: only 13.7% of seats are international.
- **#2 LAX (66.9):** LAX is the most congested airfield (266,820 departures) and the strongest international gateway (30.8% of seats), so it leads on both of those categories. It scores zero on growth because passengers shrank by -2.5% per year from CY2019 to CY2024. That decline alone costs it first place.
- **#3 SFO (54.5):** SFO has an international profile similar to LAX (28.3%) but less airfield pressure (190,763 departures). It is also shrinking, at -2.0% per year, so it trails on both congestion and growth.
- **#4 SAN (44.5):** SAN grows almost as well as SEA (0.2% per year). However, it is the least busy airfield of the set (113,704 departures), which gives it zero congestion points. It is also almost entirely domestic, with only 3.9% international seats.

### What drives the ranking
- **Congestion, growth and long-haul** separate these airports.
- **Unmet demand** barely differs: load factors range from 79.3% (SAN) to 81.9% (LAX), all near the ~80–85% level where turned-away demand becomes material.

### How to read this
- **Relative scoring:** The airports were scored relative to each other. For congestion and growth, 100 means best of these four, not of the US. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Growth is a min-max scale:** SEA's "100" on growth reflects just 0.3% per year, so no airport here is growing strongly.
- **Data:** Coverage is 1 for all four, so no category is missing. The data covers FAA CY2024 enplanements, CY2019→CY2024 growth, and the latest 12 months of BTS T-100 data.
- **Congestion caveat:** Congestion is measured by departure volume, not true capacity utilization.

SEA and LAX are close. A return to growth at LAX would likely flip the top spot, and adding PDX would show how a medium hub compares.

### Turn 2
**User:** Why did the top one win?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["SEA","LAX","SFO","SAN"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SEA","name":"Seattle-Tacoma International","score":69.3,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":64.7,"contribution":19.4,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷…

**Agent answer:**

**SEA wins by 2.4 points (69.3 vs 66.9) because of growth alone.** LAX beats it on almost everything else, but not by enough to make up for its decline in passengers.

### Where SEA wins
- **Growth:** SEA's passengers grew 0.3% per year from CY2019 to CY2024, the best of the four. That earns the full growth contribution of 20 points. LAX shrank by -2.5% per year, the worst of the set, so it gets 0. This is the decisive category.

### Where LAX wins
- **Congestion:** LAX had 266,820 departures in the latest 12 months against SEA's 212,841. LAX earns the full 30 congestion points and SEA earns 19.4.
- **Long-haul:** 30.8% of LAX seats are international against 13.7% at SEA. That gives LAX 12.3 points and SEA 5.5.
- **Unmet demand:** This is effectively a tie. LAX planes ran 81.9% full and SEA's ran 81.5% full, worth 24.6 and 24.5 points.

### Caveat
SEA's growth lead looks bigger than it is. Growth is scored min-max within these four airports, so a modest 0.3% per year becomes a "100" simply because LAX sets the bottom at -2.5%. If LAX's traffic flattened, or if the comparison set changed, the top spot could flip.

I can also compare these airports against a medium hub such as PDX if useful.
