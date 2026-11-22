# long-interrupt

- **Group:** G12-long
- **Turns:** 5

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Handles the off-topic turn, then resumes with the prior airports intact",
    "Adds SAN to the ranking",
    "Final summary consistent with earlier turns"
  ],
  "mustNot": [
    "Lose the Bay Area context after the interruption",
    "Answer the weather"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Rank the Bay Area airports.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Bay Area"]})`, `score_airports({"airport_codes":["SFO","SJC","OAK"]})`
  - find_airports_by_city → ok: {"results":{"Bay Area":{"matchedAs":"metro","airports":[{"code":"SFO","name":"San Francisco International","city":"San Francisco International Airport","state":"CA","hubType":"L","latestEnplanements":25078968,"secondary":false},{"code":"SJC","name":"Norman Y Mineta San Jose International","city":"San Jose","state":"CA","hubType":"M","latestEnplanements":5822019,"secondary":false},{"code":"OAK","na…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":85.8,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

**SFO leads the Bay Area by a wide margin, 52.8 points ahead of OAK (85.8 vs 33), with SJC third.**

- **#1 SFO (85.8):** It is the busiest airfield by far, with 190,763 departures against about 47,000 at each of the others, so it takes the full congestion contribution. It also has the highest international share (28.3% of seats) and the fullest planes (81.7%), which is near the point where peak-day demand starts being turned away. Its growth is negative at -2.0% per year, but it still earns the full growth score because the other two shrank faster.
- **#2 OAK (33):** OAK edges out SJC on growth (-4.2% vs -5.4% per year) and on international share (9.4% vs 4.4%). Its 73.8% load factor still contributes solidly. It gets no congestion credit because it is the least busy of the three.
- **#3 SJC (23.6):** SJC has the most passengers of the two medium hubs (5,822,019 enplanements in CY2024). However, it has the steepest decline (-5.4% per year), the lowest international share (4.4%) and the emptiest planes (72.7%). Its departures (47,285) are almost the same as OAK's, so it gets only a sliver of congestion credit.

### Why SFO wins
- **Congestion** creates the biggest gap: 30 points to SFO against roughly 0 for both others.
- **Growth** is next: about 13 points over OAK and 20 over SJC.
- **Long-haul** adds about 7.5 points over OAK.
- **Unmet demand** barely separates them. Load factor scores close together, so OAK and SJC keep most of their points from it.

### How to read this
- **Scoring is relative to these three.** For congestion and growth, 100 means best of these three, not of the whole U.S. Unmet demand is the load factor itself. Long-haul is the international share scored against 50%.
- **Coverage is complete** for all three, with no missing categories.
- **Data windows:** FAA CY2024 enplanements, CY2019→CY2024 growth, and BTS T-100 for the latest 12 months.
- **Key caveat: all three airports are still shrinking versus 2019.** SFO's top growth score only means it declined the least. On an absolute national basis, growth would look weak for the whole region.

A return to traffic growth at OAK or SJC, especially new international service, would narrow the gap. Nothing in this data suggests either could challenge SFO's lead on congestion and long-haul.

### Turn 2
**User:** Why is SFO ahead of OAK?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["SFO","OAK","SJC"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":85.8,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

**SFO leads OAK by 52.8 points (85.8 vs 33). Nearly all of that comes from congestion and growth.**

### Where the gap comes from
- **Congestion (about 30 points):** SFO had 190,763 departures in the latest 12 months against 47,022 at OAK. SFO is the busiest of the three and gets the full 30-point contribution. OAK is the least busy and gets 0.
- **Growth (about 13 points):** Both airports are below CY2019 traffic. SFO's decline is milder, -2.0% per year from CY2019 to CY2024 against -4.2% at OAK. That earns SFO 20 points and OAK 7.1.
- **Long-haul (about 7.5 points):** 28.3% of SFO's seats are international against 9.4% at OAK, worth 11.3 points against 3.8.

### Where OAK keeps up
- **Unmet demand** is close: 81.7% load factor at SFO against 73.8% at OAK, worth 24.5 points against 22.1. OAK keeps most of its score from this category.

### How to read this
- **The scoring is relative to SFO, OAK and SJC.** For congestion and growth, 100 means best of these three, not of the U.S. So OAK's 0 for congestion means "least busy here," not "uncongested." SFO's full growth score only means it shrank least.
- **Data:** Coverage is complete for both airports. The figures use FAA CY2024 enplanements and BTS T-100 data for the latest 12 months.

Sustained growth at OAK, or new international service there, would narrow the gap. The congestion difference is structural and unlikely to close. I can also look at OAK's recovery trend in more detail if useful.

### Turn 3
**User:** what's the weather in SF?

- **Classified as:** off_topic
- **Tools called:** (none)

**Agent answer:**

Sorry, I can only help with **U.S. airports and airport investment**: passenger traffic, comparing airports, and expansion or modernization questions.
Try something like *"Which Midwest airports look like good modernization candidates?"*

### Turn 4
**User:** ok, back to airports — add San Diego to the ranking.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["San Diego"]})`, `score_airports({"airport_codes":["SFO","OAK","SJC","SAN"]})`
  - find_airports_by_city → ok: {"results":{"San Diego":{"matchedAs":"metro","airports":[{"code":"SAN","name":"San Diego International","city":"San Diego","state":"CA","hubType":"L","latestEnplanements":12780013,"secondary":false}]}}}
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":77.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

I need San Diego's code via lookup.



**SFO still leads, now 18.6 points ahead of San Diego (77.9 vs 59.3). SAN enters at #2, ahead of OAK and SJC.**

- **#1 SFO (77.9):** It is the busiest airfield (190,763 departures), so it keeps the full 30-point congestion contribution. It has the highest international share (28.3% of seats) and the fullest planes (81.7%). Its score fell from 85.8 only because SAN now sets the growth benchmark. SFO's -2.0% per year now earns a growth subscore of 60.3.
- **#2 SAN (59.3):** SAN is the only airport in the set that grew from CY2019 to CY2024, at 0.2% per year, so it takes the full growth contribution (20 points). It ranks second on congestion (113,704 departures, worth 13.9 points). Its planes are nearly as full as SFO's (79.3%). Its weak spot is long-haul: only 3.9% of seats are international, the lowest of the four.
- **#3 OAK (30.2):** It gets solid credit for unmet demand (73.8% full) and the second-highest international share (9.4%). It gets no congestion credit, and its -4.2% per year decline earns little on growth.
- **#4 SJC (23.6):** It is last on growth (-5.4% per year), load factor (72.7%) and near-last on congestion (47,285 departures).

### Why SFO beats SAN
- **Congestion** is the biggest gap: 30 points against 13.9.
- **Long-haul** is next: 11.3 points against 1.6.
- **Trade-off:** SAN wins **growth** (20 points against 12.1), which is the only category where it beats SFO. Unmet demand is nearly even (24.5 vs 23.8).

### How to read this
- **Scoring is relative to these four.** For congestion and growth, 100 means best of this set, not of the U.S.
  - Adding SAN changed the growth benchmark. That is why SFO's and OAK's scores dropped from the earlier three-airport ranking even though their data did not change.
  - Unmet demand is the load factor itself. Long-haul is the international share scored against 50%.
- **Coverage is complete** (1) for all four, with no missing categories and no unknown codes.
- **Data windows:** FAA CY2024 enplanements and CY2019→CY2024 growth; BTS T-100 for the latest 12 months.

SAN's growth is barely positive, so a slip below CY2019 traffic would erase much of its edge over OAK. New international service would be the clearest way for SAN to close on SFO.

### Turn 5
**User:** Summarize your top recommendation.

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["SFO","SAN","OAK","SJC"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"SFO","name":"San Francisco International","score":77.9,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV…

**Agent answer:**

**Top recommendation: SFO. It leads the four-airport set by 18.6 points over SAN (77.9 vs 59.3), and it leads on capacity pressure, which carries the most weight.**

### Why SFO
- **Congestion:** It has the busiest airfield by far, with 190,763 departures in the latest 12 months. That earns the full 30-point contribution, against 13.9 for SAN. This is the strongest signal that added capacity would be used.
- **Unmet demand:** Planes run 81.7% full, the highest in the set. That is at the level where peak-day demand starts to be turned away.
- **Long-haul:** 28.3% of seats are international, far above the others. International traffic is high-margin, and customs facilities are hard for rival airports to copy.
- **Best fit:** Capacity and terminal expansion, especially for international gates and processing.

### The main risk
- **SFO is still shrinking.** Passengers fell 2.0% per year from CY2019 to CY2024. Its 60.3 growth subscore is relative to this set: it reflects a milder decline than OAK and SJC, not real growth.
- An expansion case therefore depends on traffic recovering. Current momentum alone does not support it.

### Runner-up
- **SAN** is the only airport in the set that grew, and only barely, at 0.2% per year. It also runs nearly as full as SFO (79.3%).
- It is a reasonable alternative for a growth-led, mostly domestic expansion. Its weakness is international service: only 3.9% of seats.

### How to read this
- **The scoring is relative to SFO, SAN, OAK and SJC.** For congestion and growth, 100 means best of these four, not of the U.S.
- **Coverage is complete** for all four airports.
- **Data windows:** FAA CY2024 enplanements and BTS T-100 data for the latest 12 months.

I can score SFO on its own against all U.S. airports, which would show how weak its growth looks nationally.
