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
- **Tools called:** `find_airports_by_region({"region":"New England"})`, `score_airports({"airport_codes":["BOS","BDL","PVD","PWM","BTV","MHT"]})`
  - find_airports_by_region → ok: {"region":"New England","matchedAs":"region","cities":["Boston","Providence","Hartford","Manchester","Portland, ME","Burlington"],"results":{"Boston":{"matchedAs":"metro","airports":[{"code":"BOS","name":"General Edward Lawrence Logan International","city":"Boston","state":"MA","hubType":"L","latestEnplanements":21090721,"secondary":false},{"code":"PVD","name":"Rhode Island Tf Green International"…
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"BOS","name":"General Edward Lawrence Logan International","score":92,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: op…

**Agent answer:**

# New England Terminal Expansion Candidates

I scored the six main New England airports against each other. A score of 100 means best in this group, not best nationally.

| Rank | Airport | Score | Departures (latest 12 mo) | Load factor | International seat share | 5-yr growth (2019→24) | 2024 vs 2019 |
|---|---|---|---|---|---|---|---|
| 1 | **BOS**, Boston Logan | **92.0** | 190,698 | 81.0% | 22.1% | +0.4%/yr | 1.019 |
| 2 | **PWM**, Portland, ME | **50.8** | 14,934 | 81.7% | 0% | +2.3%/yr | 1.122 |
| 3 | **BDL**, Hartford (Bradley) | **47.5** | 30,284 | 81.5% | 1.5% | −0.2%/yr | 0.988 |
| 4 | BTV, Burlington | 39.5 | 10,102 | 80.9% | 0.1% | −0.5%/yr | 0.976 |
| 5 | PVD, Providence (T.F. Green) | 30.5 | 21,824 | 78.1% | 0.3% | +0.2%/yr | 1.008 |
| 6 | MHT, Manchester | 0.1 | 10,420 | 75.1% | 0% | −5.8%/yr | 0.743 |

## The strongest candidates

**1. Boston Logan (BOS) is the clear leader.** It has about 21.1M enplanements and over six times the departures of the next airport. Its planes are about 81% full, and 22.1% of its seats are international. International traffic earns the highest margins and needs customs (FIS) facilities that are costly to build. That makes international and gate capacity the most likely expansion targets here. The weak spot is growth: only about 0.4% per year since 2019. The case for expanding BOS is capacity pressure, not rapid traffic growth.

**2. Portland, ME (PWM) is the best growth play.** It has the fullest planes in the region (81.7%) and the fastest growth: +2.3% per year, with 2024 traffic 12% above 2019. It is small and not congested, and it has almost no international service. A modest terminal or gate expansion to absorb growing demand looks more plausible than a major project.

**3. Hartford (BDL) is worth a look.** Its planes are nearly as full (81.5%), and it is the region's only medium hub, with 3.3M enplanements. Traffic is flat (−0.2% per year), however, so the case depends on unmet demand rather than growth.

## Weaker candidates
- **BTV and PVD** have full-enough planes, but traffic is flat or slightly down and congestion is low. Neither shows a strong demand signal yet.
- **MHT should not be considered for expansion.** Its planes have the lowest load factor (75.1%), passengers have fallen 5.8% per year, and traffic is only 74% of its 2019 level. It already has spare capacity.

## Caveats
- **This is not a direct measure of terminal capacity.** The congestion score counts departures, which reflects airfield activity. It does not measure terminal crowding, gate use or how big each terminal already is. I don't have data on existing gates, square footage, projects already planned or airport finances, all of which matter for a terminal decision.
- **The scores are relative.** The load factors only range from 75% to 82%, so small differences become large score gaps. All of the airports except MHT are near the roughly 80–85% level where airlines start turning passengers away on busy days.
- The flight and seat figures are from the latest 12 months of BTS T-100 data. Enplanements and growth are from FAA data through 2024.

I can also score BOS, PWM and BDL against all U.S. airports to see how they compare nationally. Would you like that?
