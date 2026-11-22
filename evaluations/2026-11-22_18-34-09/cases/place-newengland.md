# place-newengland

- **Group:** G5-place
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "find_airports_by_region",
      "inputContains": {
        "region": "New England"
      }
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Resolves New England to real airports first",
    "Ranks/assesses them with real data"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Which airports in New England are candidates for terminal expansion?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_region({"region":"New England"})`, `score_airports({"airport_codes":["BOS","BDL","PVD","PWM","BTV"]})`
  - find_airports_by_region → ok: {"region":"New England","matchedAs":"region","cities":["Boston","Providence","Hartford","Manchester","Portland, ME","Burlington"],"results":{"Boston":{"matchedAs":"metro","airports":[{"code":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","latestEnplanements":21090721,"secondary":false},{"code":"PVD","name":"Rhode Island Tf Green International"…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"BOS","name":"General Edward Lawrence Logan International","score":69.3,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: …

**Agent answer:**

**BOS is the strongest terminal-expansion candidate in New England, leading PWM by 24 points (69.3 vs 45.3).** PWM is the best smaller-airport candidate. BDL, PVD and BTV trail well behind.

- **#1 BOS (69.3):** Its lead comes mostly from congestion. BOS had 190,698 departures in the latest 12 months, the busiest airfield here by far, so it takes the full 30-point congestion contribution. It is also New England's only real international gateway, with 22.1% of seats international. Its weakness is growth: passengers rose only 0.4% per year from CY2019 to CY2024.
- **#2 PWM (45.3):** It wins on growth, with the fastest rise in the set at 2.3% per year. It also has the fullest planes at 81.7%, which points to real spilled demand. However, it is small (14,934 departures) and has essentially no international traffic (0%). That makes it a candidate for incremental terminal or gate capacity rather than a major build-out.
- **#3 BDL (30.3):** Its planes are full (81.5%), and its departures (30,284) rank second in the region. But growth is slightly negative at -0.2% per year, and international is only 1.5% of seats.
- **#4 PVD (30.1):** It is essentially tied with BDL. It has the lowest load factor in the set (78.1%), which leaves the least spilled demand, along with flat growth (0.2% per year) and 0.3% international seats.
- **#5 BTV (24.3):** It has the smallest airfield (10,102 departures), the weakest growth (-0.5% per year) and almost no international service (0.1%). Only its 80.9% load factor keeps it on the board.

### Trade-offs
- **Unmet demand doesn't separate them.** Every airport runs between 78.1% and 81.7% full, so this category adds roughly the same points to each. The ranking is driven by congestion, growth and long-haul.
- **BOS is the case for scale; PWM is the case for momentum.** If you weight growth more heavily than congestion, PWM looks relatively better.

### How to read this
- **Relative scoring:** The airports were scored relative to each other. For congestion and growth, 100 means the best of these five, not of the US. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Coverage:** Coverage is 1 for all five, so no category is missing.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 data for the latest 12 months.
- **Congestion caveat:** This category uses departure volume as a proxy, not true capacity utilization. It doesn't capture whether a terminal is physically constrained.
- **Excluded airport:** MHT (Manchester, 633,257 enplanements) was left out because the tool accepts at most 5 codes. I can score it against PWM or BDL if useful.

A rebound in BOS growth would widen its lead. Sustained growth plus new international service at PWM would narrow it.
