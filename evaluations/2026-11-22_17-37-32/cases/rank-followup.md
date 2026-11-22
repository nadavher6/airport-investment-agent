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
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# West Coast Large Hubs: Investment Ranking

The West Coast region has four FAA large hubs: LAX, SEA, SFO and SAN. Portland (PDX) is a medium hub, so it is not included.

| Rank | Airport | Score | Congestion (30%) | Unmet demand (30%) | Long-haul (20%) | Growth (20%) |
|---|---|---|---|---|---|---|
| 1 | **LAX**: Los Angeles Intl | **80.0** | 266,820 departures | 81.9% load factor | 30.8% intl seats | −2.5%/yr |
| 2 | **SEA**: Seattle-Tacoma | **72.1** | 212,841 | 81.5% | 13.7% | +0.3%/yr |
| 3 | **SFO**: San Francisco Intl | **64.5** | 190,763 | 81.7% | 28.3% | −2.0%/yr |
| 4 | **SAN**: San Diego Intl | **19.2** | 113,704 | 79.3% | 3.9% | +0.2%/yr |

Growth is the 5-year enplanement CAGR from 2019 to 2024.

## What drives the ranking

**1. LAX (80.0)** has the highest value of the set on three of the four measures. It is the busiest airfield, has the fullest planes and has the largest international share, nearly a third of all seats. Its weakness is recovery. In 2024 it handled only about 88% of its 2019 passengers (37.8M enplanements). This weakness also means there is pent-up capacity to win back. Investment here would likely favor **modernization and premium/international facilities** more than raw expansion.

**2. SEA (72.1)** has the most balanced profile. It is one of only two airports that are fully back above 2019 levels (101.7%). It also has the second-highest congestion and solid load factors. Its long-haul share is modest at 13.7%. The case for SEA is **capacity expansion backed by demand that has already returned**.

**3. SFO (64.5)** is close to LAX on international mix (28.3%) and load factor (81.7%). It loses points for weak recovery (about 90% of 2019) and lower congestion. As at LAX, the opportunity leans toward **international and premium upgrades**, while domestic volume is still soft.

**4. SAN (19.2)** has steady growth (back to 101% of 2019). It ranks last on the other three measures, with almost no international traffic and the lightest airfield activity.

## Caveats

- **These are relative scores.** 100 means "best of these four" and 0 means "worst of these four." They do not measure quality against the whole country.
  - The low SAN score overstates how far behind it is. On load factor, the four airports are only about 2.6 points apart (79.3% to 81.9%), yet SAN gets a 0.
  - SAN's growth score (95.8) and SEA's (100) are also based on tiny real differences (+0.2% vs +0.3% per year).
- **The congestion measure is approximate.** It uses departure volume as a stand-in, because annual service volume (the airfield's true capacity) isn't published. A busy airport isn't necessarily constrained.
- **The 2019–2024 growth window is distorted by COVID.** It penalizes airports with slow recovery, such as the business-travel-heavy Bay Area and LA, more than it reflects their long-term demand.
- **Some factors are not in the score.** It leaves out physical constraints such as land, gate counts and runway limits, and it ignores capital costs, airline lease terms and competition from nearby airports. For example, OAK and SJC compete with SFO, and SNA, BUR, ONT and LGB compete with LAX.

## Possible next steps

- Score each airport on the **absolute** scale against all U.S. airports, to see how SAN actually compares nationally.
- Compare a metro's main hub with its secondary airports, such as LAX vs SNA, BUR and ONT, or SFO vs OAK and SJC.
- Pull the detailed enplanement history, including national rank and year-over-year change, for any of these airports.

### Turn 2
**User:** Why did the top one win?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["LAX","SEA","SFO","SAN"]})`
  - score_airports → ok: {"mode":"relative","ranking":[{"airportCode":"LAX","name":"Los Angeles International","score":80,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operations ÷ ASV)","…

**Agent answer:**

# Why LAX Ranked First

LAX scored **80.0** because it had the **highest value of the four airports on three of the four measures**. Those three measures carry 80% of the weight. It finished last on the fourth, growth.

## Score breakdown

| Factor (weight) | LAX value | LAX sub-score | LAX points | SEA points (#2) | LAX lead |
|---|---|---|---|---|---|
| Congestion (30%) | 266,820 departures | 100 | 30.0 | 19.4 | **+10.6** |
| Unmet demand (30%) | 81.9% load factor | 100 | 30.0 | 25.4 | **+4.6** |
| Long-haul share (20%) | 30.8% intl seats | 100 | 20.0 | 7.3 | **+12.7** |
| Growth (20%) | −2.5%/yr (2019–24) | 0 | 0.0 | 20.0 | **−20.0** |
| **Total** | | | **80.0** | **72.1** | **+7.9** |

## The main drivers

1. **Long-haul share (+12.7 points over SEA).** About 30.8% of LAX seats are international, which is 13.5M of 43.9M seats. SEA's share is 13.7%. International traffic tends to earn more per passenger, through higher fees and premium cabins, and it requires customs facilities that competing airports can't easily copy.
2. **Congestion (+10.6).** LAX had about 54,000 more departures than SEA, roughly 25% more, so it has the most activity on its airfield.
3. **Load factor (+4.6).** LAX planes were the fullest of the group. However, the real gap is small: 81.9% vs. 81.5%.

Together, these three leads add up to 27.9 points. That outweighs the 20 points LAX gives up on growth, because LAX has the weakest recovery. It handled only about 88% of its 2019 passengers in 2024.

## How solid is the win?

- **The scoring is relative.** "100" means "best of these four," not "best in the country." Each sub-score is scaled between the lowest and highest airport in the set. Even a small lead can therefore earn full marks. For example, LAX's 0.4-point load-factor advantage over SEA is worth 4.6 points.
- **The result depends on how much growth is weighted.** I recalculated the scores using the tool's sub-scores and kept the other three weights in the same proportions. **If growth gets more than about 26% of the weight (instead of 20%), SEA moves into first place.** With all four factors weighted equally at 25%, LAX still wins, but only by 75.0 to 71.4.
- **What it means for investment.** LAX wins on how large and how international its traffic is, not on how fast that traffic is growing. This supports **modernization and international/premium facilities** more than adding raw capacity. If your investment thesis is mainly about growth, SEA is the stronger candidate.

Would you like me to run any of these on the absolute (national) scale, or compare LAX against nearby competitors such as SNA, BUR, ONT and LGB?
