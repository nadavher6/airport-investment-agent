# rank-fastest

- **Group:** G7-rank
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "tools": [
    {
      "name": "get_enplanements",
      "optional": true
    },
    {
      "name": "score_airports",
      "optional": true
    }
  ],
  "answerCriteria": [
    "Gives a ranked list with real growth figures",
    "Does NOT answer from general knowledge",
    "Produces a non-empty answer"
  ],
  "mustNot": [
    "Say figures are approximate/from memory",
    "Invent figures",
    "Return an empty answer"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Which large hub airports have grown the fastest since 2015?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["ATL","DFW","DEN","ORD","LAX","JFK","CLT","LAS","MCO","MIA","PHX","SEA","SFO","EWR","IAH","BOS","FLL",…)`
  - score_airports → error: Invalid input for score_airports: airport_codes — max 5 airports; pick the 5 most relevant (invalid_input).: Invalid input for score_airports: airport_codes — max 5 airports; pick the 5 most relevant (invalid_input).

**Agent answer:**

I can't rank all the large hubs in one pass, and I don't have any growth figures yet, so I won't name winners.

**What's limiting this:**
- **Scoring tool limit:** It takes at most 5 airports per comparison, and my last call listed about 30.
- **That list wasn't verified:** I wrote it from memory instead of confirming each airport's hub classification with the lookup tools, so it shouldn't be relied on.
- **"Since 2015" comes from a different measure:** The scoring tool's growth category covers CY2019→CY2024. Growth since 2015 comes from the FAA enplanement data, which reports a 2015→2024 compound annual growth rate. Strictly, that covers 9 periods, not a true 10-year rate. It returns one airport per call, and I can make up to 6 calls per question.

**Ways forward:**
1. **Pick up to 5 large hubs** and I'll compare their growth since 2015 directly (from 2019 too, if useful).
2. **Pick a region** (e.g. Southeast, Mountain West, Southwest). I'll find its airports with the lookup tool, keep the large hubs and compare their growth.
3. **Work through the full list in batches.** I'll confirm the large hubs first, then cover them a few at a time across several questions.

Which would you like? I can also add long-haul share or congestion afterwards.
