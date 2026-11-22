# off-weather

- **Group:** G3-offtopic
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "off_topic",
  "forbidTools": [
    "get_enplanements",
    "score_airports",
    "get_airport_by_code",
    "find_airports_by_city",
    "find_airports_by_region"
  ],
  "answerCriteria": [
    "Declines politely",
    "Redirects to airports"
  ],
  "mustNot": [
    "Answer the weather"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** what's the weather in California?

- **Classified as:** off_topic
- **Tools called:** (none)

**Agent answer:**

Sorry, I can only help with **U.S. airports and airport investment**: passenger traffic, comparing airports, and expansion or modernization questions.
Try something like *"How has BOS passenger traffic changed since 2019?"*
