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

# New England Airports: Candidates for Terminal Expansion

I scored all six primary New England airports with the Investment Attractiveness Score. **The scores are relative to this group**, so 100 means "best of these six," not best in the U.S.

| Rank | Airport | Score | Departures (12 mo) | Load factor | Int'l seat share | 5-yr CAGR (2019→24) | 2024 vs 2019 |
|---|---|---|---|---|---|---|---|
| 1 | **BOS** – Boston Logan (Large hub) | **92.0** | 190,698 | 81.0% | 22.1% | +0.4%/yr | 101.9% |
| 2 | **PWM** – Portland, ME (Small hub) | **50.8** | 14,934 | 81.7% | 0.0% | +2.3%/yr | 112.2% |
| 3 | **BDL** – Hartford Bradley (Medium hub) | **47.5** | 30,284 | 81.5% | 1.5% | −0.2%/yr | 98.8% |
| 4 | **BTV** – Burlington (Small hub) | 39.5 | 10,102 | 80.9% | 0.1% | −0.5%/yr | 97.6% |
| 5 | **PVD** – Providence (Small hub) | 30.5 | 21,824 | 78.1% | 0.3% | +0.2%/yr | 100.8% |
| 6 | **MHT** – Manchester (Small hub) | 0.1 | 10,420 | 75.1% | 0.0% | −5.8%/yr | 74.3% |

## Top candidates

**1. Boston Logan (BOS) is the clear leader.** It has about six times the departures of any other airport in the region. It leads strongly on international traffic, with 22.1% of seats, which is high-margin and protected by customs and border facilities. Its planes are also full, at an 81% load factor. The weak spot is growth: only 0.4% per year since 2019. So the case for BOS rests on congestion and the high value of its traffic, not on growing volume. That fits modernizing and adding international or gate capacity better than a speculative build-out.

**2. Portland, ME (PWM) is the best growth story.** It has the highest load factor in the group (81.7%) and the fastest growth (+2.3% per year). It is also the only airport here well above its 2019 traffic, at 12% higher. It is small (about 1.2M enplanements) and almost entirely domestic. That points to a right-sized terminal or gate expansion rather than a major project.

**3. Hartford Bradley (BDL) is a solid secondary option.** Its planes are full (81.5%) and it is the region's second-busiest airfield. However, traffic is flat to slightly down versus 2019 (98.8%). Expansion would depend on airlines adding service, for example to capture Boston or New York overflow.

## Weaker candidates
- **BTV** has full planes but low volume and slight decline, so there is little case for added capacity.
- **PVD** has a lower load factor (78.1%), which suggests existing capacity isn't being strained.
- **MHT** is the weakest. Traffic is still at only 74% of 2019 levels, falling 5.8% per year, and load factor is the lowest at 75.1%. Its problem is losing traffic, not lacking space.

## Assumptions and data limits
- **This score does not directly measure terminal capacity.** The congestion measure uses departure counts, because airfield capacity data is not freely published. I have no data on gate counts, terminal square footage, or peak-hour passenger throughput, which are the key inputs for a terminal decision.
- **Load factors are tightly clustered.** Five of the six airports fall between 78% and 82%. The relative scoring stretches small differences, so PWM, BDL, and BTV are closer on demand pressure than their sub-scores suggest.
- **Scale differences matter.** BOS outranks everyone partly because of its size. Among smaller airports, PWM stands out on its own merits.
- **Not included:** existing or planned capital projects, airline commitments, airport finances or bonding capacity, and land constraints. All of these should be checked before investing.

I can also score BOS and PWM against all U.S. airports, or pull their full enplanement trend history.
