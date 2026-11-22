# greet-hi

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
    "Friendly, brief",
    "Offers what it can do",
    "No airport data dumped"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** hi

- **Classified as:** greeting
- **Tools called:** (none)

**Agent answer:**

Hi! I'm an airport investment research assistant for U.S. airports. I can help you find airports where modernization or expansion would be most profitable.

Here's what I can do:

- **Look up airports** by code (e.g., "JFK"), by city or metro area (e.g., "Bay Area", "NYC"), or by region (e.g., West Coast, Southeast, Mountain West).
- **Pull FAA passenger data**: latest enplanements, hub size, national rank, year-over-year change, 5-year and 2015–2024 growth rates, and COVID recovery vs. 2019.
- **Score and rank airports** with an Investment Attractiveness Score (0–100). It blends congestion, unmet demand (load factor), long-haul/international share, and growth. I can explain what drives each score.

Some example questions:
- "Which West Coast airport is the best expansion candidate?"
- "Compare DEN, PHX, and LAS for investment potential."
- "How has Austin's airport grown since 2019?"

What would you like to look into?
