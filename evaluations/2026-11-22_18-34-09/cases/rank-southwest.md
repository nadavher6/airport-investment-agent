# rank-southwest

- **Group:** G7-rank
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "find_airports_by_region",
      "inputContains": {
        "region": "Southwest"
      }
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Resolves the Southwest region, then ranks with real data"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Best airports for terminal expansion in the Southwest?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_region({"region":"Southwest"})`, `score_airports({"airport_codes":["PHX","LAS","ABQ","ELP","TUS"]})`
  - find_airports_by_region → ok: {"region":"Southwest","matchedAs":"region","cities":["Phoenix","Tucson","Albuquerque","Las Vegas","El Paso"],"results":{"Phoenix":{"matchedAs":"metro","airports":[{"code":"PHX","name":"Phoenix Sky Harbor International","city":"Phoenix","state":"AZ","hubType":"L","latestEnplanements":25595723,"secondary":false}]},"Tucson":{"matchedAs":"metro","airports":[{"code":"TUS","name":"Tucson International",…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"PHX","name":"Phoenix Sky Harbor International","score":70.7,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations …

**Agent answer:**

**PHX leads LAS by 3.3 points (70.7 vs 67.4); both are well ahead of the three smaller airports.**

- **#1 PHX (70.7):** The busiest airfield in the set (221,624 departures), so it takes the full congestion contribution. It also has the fullest planes (79.1%) and solid growth of 2.7% per year (CY2019→CY2024). It is held back only by a small international share (5.4%).
- **#2 LAS (67.4):** This is almost PHX's twin. It matches PHX on growth (2.7% per year) and is close on load factor (78.8%). It has the highest international share of the five (5.9%). Its gap to PHX comes almost entirely from congestion: 198,194 departures, against PHX's 221,624.
- **#3 ELP (42.3):** It has the fastest growth in the set (3.5% per year), which earns the full growth contribution. But it is a small, lightly used airfield (21,712 departures), with the emptiest planes (71.9%) and little international traffic (1.6%).
- **#4 TUS (28.1):** Its planes run reasonably full (76.4%). However, it has the fewest departures (20,933), essentially no international seats (0%), and slow growth (1.2% per year).
- **#5 ABQ (23.4):** Growth is nearly flat (0.4% per year, the lowest here). Its international share is 0%, and its load factor is modest (73.6%), so little points to capacity pressure.

### What this means for terminal expansion
- **PHX and LAS are the real candidates.** They combine high volume, the fullest planes and steady growth.
- **ELP** is a growth story rather than a capacity-pressure story. It fits modest, phased modernization better than a major terminal build.
- **Caveat:** no airport here exceeds the ~80–85% load-factor level where turned-away demand becomes material. The unmet-demand signal is therefore moderate everywhere, including at PHX and LAS.

### How to read this
- **Relative scoring:** the airports are scored relative to each other. For congestion and growth, 100 means best of these five, not best in the US. Unmet demand is the load factor % itself, and long-haul is the international seat share scored against a 50% benchmark.
- **Coverage:** coverage is 1 for all five, so no category is missing, and no codes were not found.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 for the latest 12 months.
- **Congestion proxy:** congestion uses departure volume as a stand-in, because airfield capacity (ASV) isn't published.
- **Region definition:** "Southwest" here covers Phoenix, Tucson, Albuquerque, Las Vegas and El Paso.

PHX and LAS are close enough that a modest rise in LAS departures or international share could swap them.
