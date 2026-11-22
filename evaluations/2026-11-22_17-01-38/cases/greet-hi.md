# greet-hi

- **Group:** G1-greeting
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "greeting",
  "forbidTools": [
    "get_enplanements",
    "score_airports"
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

Hi! I'm an airport investment research assistant for U.S. airports. I help find airports where modernization or expansion would likely pay off the most.

Here's what I can do:

- **Look up airports** by code (e.g., `JFK`), by city or metro area (e.g., "Bay Area," "Twin Cities"), or by region (West Coast, Southeast, Mountain West, Gulf Coast, and others).
- **Pull FAA passenger data (CY2015–CY2024):** enplanements, hub size, national rank, year-over-year change, growth rates, and how far traffic has recovered compared with 2019.
- **Score and rank airports** with an Investment Attractiveness Score from 0 to 100. It combines four factors: congestion, unmet demand (load factor), long-haul/international share, and growth. I can show the evidence behind each score.

Some example questions:
- "Which West Coast airports are the best expansion candidates?"
- "Compare DEN, PHX, and LAS for investment potential."
- "How has Austin's airport grown since 2019?"

What would you like to look into?
