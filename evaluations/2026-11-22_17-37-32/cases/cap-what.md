# cap-what

- **Group:** G2-capabilities
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "capabilities",
  "forbidTools": [
    "get_enplanements",
    "score_airports",
    "get_airport_by_code",
    "find_airports_by_city",
    "find_airports_by_region"
  ],
  "answerCriteria": [
    "Describes airport-investment capabilities",
    "No main-LLM hallucination"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** what can you do?

- **Classified as:** capabilities
- **Tools called:** (none)

**Agent answer:**

I'm an **airport investment research assistant** for U.S. airports. I can help you:
- Look at **passenger traffic**: official FAA enplanement data for CY2015–CY2024, with year-over-year change and growth trends
- **Compare airports** and discuss which ones look like strong candidates for terminal expansion or modernization
- **Explain my reasoning** and state the assumptions and data limits behind an answer

Ask me something like *"How has BOS passenger traffic changed since 2019?"* or *"Compare LAX and SNA."*
I don't answer questions outside U.S. airports and aviation investment.
