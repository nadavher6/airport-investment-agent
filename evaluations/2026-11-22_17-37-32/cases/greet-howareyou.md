# greet-howareyou

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
    "Brief, in character",
    "Redirects to airports"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** hey, how are you today?

- **Classified as:** greeting
- **Tools called:** (none)

**Agent answer:**

I'm doing well, thanks for asking! I'm ready to help with U.S. airport investment research.

Here's what I can do:

- **Find airports** for a city, metro area, or region (e.g., "Bay Area," "Pacific Northwest," "Gulf Coast")
- **Pull FAA passenger data**, including enplanements, hub size, national rank, growth rates, and post-COVID recovery
- **Score and rank airports** on how attractive they are for expansion, based on congestion, unmet demand, long-haul share, and growth, with an explanation of what drives each score

For example, you could ask:
- "Which West Coast airports look most promising for expansion?"
- "Compare Austin, Nashville, and Raleigh-Durham."
- "How has Denver's traffic grown since 2015?"

What would you like to look into?
