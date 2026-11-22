# greet-thanks

- **Group:** G1-greeting
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "greeting",
  "forbidTools": [
    "get_enplanements",
    "score_airports",
    "get_airport_by_code",
    "find_airports_by_city",
    "find_airports_by_region"
  ],
  "answerCriteria": [
    "Polite acknowledgement",
    "Offers to continue"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** thanks, that's helpful!

- **Classified as:** greeting
- **Tools called:** (none)

**Agent answer:**

You're welcome! If you'd like to dig further, I can:

- **Compare more airports** with the Investment Attractiveness Score (congestion, unmet demand, long-haul share, growth)
- **Pull FAA enplanement trends** for any airport: growth rates, national rank, COVID recovery
- **Scan a region or metro** (e.g., Southeast, Mountain West, Bay Area) to find expansion candidates

Just tell me the airports, cities, or region you're interested in.
