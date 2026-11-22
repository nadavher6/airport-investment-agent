# single-anc-longhaul

- **Group:** G4-single
- **Turns:** 1

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
          "ANC"
        ]
      }
    }
  ],
  "answerCriteria": [
    "Gives the international seat share with its basis (BTS T-100)"
  ],
  "mustNot": [
    "Invent figures"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** What is the long-haul / international share out of Anchorage?

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Anchorage"]})`, `score_airports({"airport_codes":["ANC"]})`
  - find_airports_by_city → ok: {"results":{"Anchorage":{"matchedAs":"metro","airports":[{"code":"ANC","name":"Ted Stevens Anchorage International","city":"Anchorage","state":"AK","hubType":"M","latestEnplanements":2767856,"secondary":false}]}}}
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"ANC","name":"Ted Stevens Anchorage International","score":64.5,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":86,"contribution":25.8,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: operati…

**Agent answer:**

# Anchorage (ANC): Long-Haul / International Share

**About 1% of ANC's passenger seats are international.** This is based on BTS T-100 data for the latest 12 months.

| Metric | Value |
|---|---|
| International seats | 36,472 |
| Total seats | 3,817,316 |
| **International share** | **~0.96%** (the tool rounds this to 1%) |
| Long-haul sub-score (vs. all U.S. airports) | 9.5 / 100 |
| Contribution to overall score | 1.9 of a possible 20 points |

ANC is the only airport the lookup returned for the Anchorage metro. It is a Medium hub with 2,767,856 enplanements in 2024.

## What this means
- **International passenger traffic is very small.** Almost all of ANC's passenger seats are domestic, including flights to the Lower 48 and within Alaska.
- **Long-haul is ANC's weakest category.** Its overall attractiveness score is 64.5/100, and most of that comes from other categories:
  - Congestion: 86 (87,705 departures)
  - Unmet demand: 83.1 (73.2% load factor)
  - Growth: 59.2 (0.4% per year growth in enplanements, 2019→2024)

## Important data limitation
This metric only counts **passenger seats**. It does not include **cargo** flights. ANC is known as a major transpacific air-cargo stopover, but cargo volumes are not in the data I can access. For ANC, the seat-based share almost certainly understates how international the airfield's activity and revenue really are. Cargo landing fees are weight-based and can be significant.

If cargo is part of your investment thesis, this score will undervalue ANC's international side. You would need separate cargo data, such as BTS T-100 freight or airport financial reports, to assess it.

Would you like me to compare ANC's international share with other airports, such as SEA, HNL, or other Medium hubs?
