# long-accumulate

- **Group:** G12-long
- **Turns:** 5

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "score_airports",
      "optional": true,
      "inputContains": {
        "airport_codes": [
          "LAX",
          "SFO",
          "SEA",
          "PDX"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Final ranking covers all four accumulated airports",
    "Grounded figures throughout"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Look at LAX.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":75.7,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX scores 75.7 out of 100, scored absolutely against all U.S. airports. Its strength is a busy, full, internationally heavy airfield. Its weakness is traffic that is still shrinking.**

### Why it scores this way
- **Congestion (full 30-point contribution):** LAX had 266,820 departures in the latest 12 months, which earns the top congestion sub-score. This is a volume proxy: true capacity (ASV) isn't published, so busy airfields are assumed to be more capacity-constrained.
- **Unmet demand (24.6 points):** Planes averaged 81.9% full (35.9M passengers on 43.9M seats). That is at the level where peak-day demand starts getting turned away, which is a real argument for added capacity.
- **Long-haul share (12.3 points):** 30.8% of seats are international, scored against a 50% benchmark. This is high-margin traffic, and LAX's existing customs and international facilities give it an advantage competitors can't easily copy.
- **Growth (8.8 points, the drag):** Enplanements fell 2.5% per year from CY2019 to CY2024, to 37.76M in CY2024. LAX hasn't recovered to pre-COVID volume, which weakens the case that new capacity would fill quickly.

### Investment read
The strongest case at LAX is **modernization and international or terminal capacity**: it's congested, full and long-haul heavy. A case built on raw passenger growth is weaker, because volumes are still below CY2019.

### Data notes
- Coverage is complete: all four categories have data and none are missing.
- **Data windows:** BTS T-100 for the latest 12 months (congestion, load factor, international share) and FAA CY2019→CY2024 enplanements (growth).

If useful, I can compare LAX against other Southern California or West Coast airports (e.g., SFO, SAN, SNA) to see how it ranks relative to peers.

### Turn 2
**User:** Now add SFO.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX leads SFO by 11.1 points (66.9 vs 55.8).**

LAX's score fell from 75.7 to 66.9 because adding SFO switches scoring from absolute (vs. all U.S. airports) to relative (vs. this pair), so it is not a change in LAX's data.

### Why
- **Congestion decides it:** LAX had 266,820 departures in the latest 12 months against SFO's 190,763. As the busier airfield of the two, LAX takes the full 30-point contribution and SFO gets none. This is a volume proxy, because true airfield capacity (ASV) isn't published.
- **Long-haul is a slight LAX edge:** 30.8% of LAX seats are international against 28.3% at SFO. Both are strong international gateways.
- **Unmet demand is effectively a tie:** planes ran 81.9% full at LAX and 81.7% at SFO. Both are near the level where peak-day demand gets turned away.

### Trade-offs
- **Growth is SFO's category, but read it carefully.** SFO gets the full 20 points and LAX gets 0. However, both airports shrank from CY2019 to CY2024: SFO by -2.0% per year and LAX by -2.5% per year. SFO wins only because it declined less. The min-max scale magnifies this small difference into the full growth contribution.

### How to read this
- **Scoring mode:** the airports are scored relative to each other. For congestion and growth, 100 means the best of these two, not of the U.S. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Coverage:** 1 for both airports, with no missing categories.
- **Data windows:** BTS T-100 covers the latest 12 months, and FAA enplanements cover CY2024, with growth measured CY2019→CY2024.

```compare
{
  "columns": ["LAX", "SFO"],
  "rows": [
    { "label": "Strengths", "cells": [[{ "kind": "markdown", "text": "Busier airfield, slightly larger international share, full planes" }], [{ "kind": "markdown", "text": "Full planes, strong international share, smaller post-COVID decline" }]] },
    { "label": "Risks", "cells": [[{ "kind": "markdown", "text": "Traffic still shrinking versus CY2019" }], [{ "kind": "markdown", "text": "Also still below CY2019; lower volume" }]] },
    { "label": "Best fit for", "cells": [[{ "kind": "markdown", "text": "Capacity, terminal and international expansion" }], [{ "kind": "markdown", "text": "Modernization and international facility upgrades" }]] }
  ]
}
```

Because the gap rests almost entirely on the departures difference, the ranking would tighten if SFO's traffic recovered faster or if a true capacity measure replaced raw volume. If useful, I can add SAN or OAK for a broader California view.

### Turn 3
**User:** Add SEA too.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO","SEA"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":66.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)"…

**Agent answer:**

**LAX leads SEA by 8.3 points (66.9 vs 58.6), with SFO a distant third at 39.4.**

- **#1 LAX (66.9):** As the busiest airfield of the three (266,820 departures in the latest 12 months), it takes the full congestion contribution. It also has the highest international share (30.8%). LAX has the weakest growth of the set (-2.5% per year, CY2019→CY2024), so it gets nothing for growth.
- **#2 SEA (58.6):** It is the only one of the three that grew, at 0.3% per year, so it earns the full growth contribution. Its departures (212,841) sit in the middle of the range. Its international share is the lowest of the set at 13.7%, which leaves it well behind on long-haul. That smaller share, together with a much lower congestion contribution, is the main reason SEA trails LAX.
- **#3 SFO (39.4):** Its planes are as full as the others (81.7%), and its international share is strong at 28.3%. However, it has the fewest departures of the set (190,763), which gives it zero for congestion. Its growth (-2.0% per year) now trails SEA, so it gets only a small share of the growth points.

### Why SFO's score fell
SFO dropped from 55.8 to 39.4, and the cause is the changed comparison set, not any change in SFO's data. Before, SFO had the best growth of the pair. Now SEA is the only grower, so SEA takes the top of the growth scale.

### How to read this
- **Scoring:** Congestion and growth are scored relative to each other, so 100 means the best of these three, not of the U.S. Unmet demand is the load factor % itself, and long-haul is the international share measured against a 50% benchmark.
- **Load factor:** This is effectively a tie across all three (81.5–81.9%), so it doesn't separate them.
- **Data coverage:** Coverage is 1 for all three, with no missing categories. The sources are BTS T-100 for the latest 12 months and FAA CY2024 enplanements, with growth measured CY2019→CY2024.

**What could change the ranking:** SEA's lead over SFO rests on growth and departures. LAX's lead over SEA depends heavily on congestion, which is a raw-volume proxy because true capacity (ASV) isn't published. If SEA added international service, the gap with LAX would narrow. If you'd like, I can add another West Coast airport such as SAN, PDX or OAK.

### Turn 4
**User:** And PDX.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO","SEA","PDX"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SEA","name":"Seattle-Tacoma International","score":70.8,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":69.5,"contribution":20.8,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷…

**Agent answer:**

**SEA now leads LAX by 3.9 points (70.8 vs 66.9), with SFO third (56.5) and PDX a distant fourth (26.5).**

### Why the lead flipped to SEA
No airport's data changed. Adding PDX resets the bottom of the congestion scale. With 89,627 departures, PDX becomes the low end, so SEA and SFO earn much larger congestion contributions than before. LAX was already at the top, so its contribution stays the same. SEA's full growth contribution now outweighs LAX's remaining edges.

- **#1 SEA (70.8):** It is still the only airport in the set that grew (0.3% per year, CY2019→CY2024), so it takes the full growth contribution of 20 points. Its 212,841 departures now earn 20.8 congestion points instead of a small share. Its weak spot is long-haul: only 13.7% of its seats are international.
- **#2 LAX (66.9):** It remains the busiest airfield (266,820 departures, the full 30 congestion points) and has the highest international share (30.8%). It also has the weakest growth of the four (-2.5% per year), so it gets zero growth points. That drag is now larger than its congestion and long-haul advantages over SEA.
- **#3 SFO (56.5):** It gains the most from PDX's arrival. Its 190,763 departures are no longer the set's minimum and now earn 17.1 congestion points. It also has a strong international share (28.3%), but its growth is negative at -2.0% per year.
- **#4 PDX (26.5):** It is the smallest airfield in the set, so it earns zero congestion points. Only 4.3% of its seats are international, and passengers declined 2.5% per year, almost as steeply as at LAX. Its one competitive category is load factor: its planes ran 81.3% full, in line with the others.

### How to read this
- **Scoring mode:** Congestion and growth are scored relative to each other, so 100 means the best of these four, not of the U.S. Unmet demand is the load factor % itself. Long-haul is the international share measured against a 50% benchmark.
- **Load factor doesn't separate them:** All four fall between 81.3% and 81.9%.
- **Coverage:** Coverage is 1 for all four airports, with no missing categories and no codes not found.
- **Data windows:** BTS T-100 covers the latest 12 months. FAA enplanements cover CY2024, with growth measured CY2019→CY2024.

**What could change the ranking:** The SEA–LAX gap is small and depends on how the set is built. Adding another smaller airport or a faster grower would rescale congestion or growth and could swap them again. A recovery in LAX traffic would also tip the ranking back toward LAX. I can also score these airports individually against all U.S. airports, which avoids these set effects.

### Turn 5
**User:** Rank everything we've looked at so far.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SFO","SEA","PDX"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SEA","name":"Seattle-Tacoma International","score":70.8,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":69.5,"contribution":20.8,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷…

**Agent answer:**

**SEA ranks first, 3.9 points ahead of LAX (70.8 vs 66.9). SFO is third (56.5) and PDX fourth (26.5).** This is the same four-airport set as the last turn, so the ranking hasn't changed.

- **#1 SEA (70.8):** It is the only airport in the set that grew (0.3% per year, CY2019→CY2024), so it takes the full 20 growth points. That single category outweighs its weaker long-haul share (13.7% international) and its smaller congestion contribution.
- **#2 LAX (66.9):** It is the busiest airfield (266,820 departures), which earns the full 30 congestion points, and it has the highest international share (30.8%). It gets zero for growth because its -2.5% per year decline is the steepest in the set.
- **#3 SFO (56.5):** It has a strong international share (28.3%) and mid-range congestion (190,763 departures). Its growth is negative (-2.0% per year), so it earns only 3.6 growth points.
- **#4 PDX (26.5):** It is the smallest airfield, so it gets zero congestion points. It also has the lowest international share (4.3%) and declined -2.5% per year. Its planes are as full as the others' (81.3%).

### How to read this
- **Relative scoring:** For congestion and growth, 100 means the best of these four airports, not of the U.S.
- **Load factor:** Unmet demand is scored as the load factor % itself. All four fall between 81.3% and 81.9%, so this category doesn't separate them.
- **Coverage:** Coverage is 1 for all four, with no missing categories and no codes not found.
- **Data windows:** BTS T-100 data covers the latest 12 months. FAA enplanements cover CY2024, with growth measured CY2019→CY2024.

**Caveat:** The SEA–LAX order depends on which airports are in the set. When PDX joined, it reset the bottom of the congestion scale, and that flipped the lead. I can score each airport absolutely against all U.S. airports for a set-independent view.
