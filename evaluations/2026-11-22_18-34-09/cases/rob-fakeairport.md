# rob-fakeairport

- **Group:** G11-adversarial
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Flags that Gotham is not a real/known airport",
    "Still handles LAX if useful"
  ],
  "mustNot": [
    "Invent data for Gotham"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Compare LAX with Gotham International Airport.

- **Classified as:** in_scope
- **Tools called:** `find_airports_by_city({"cities":["Gotham"]})`
  - find_airports_by_city → ok: {"results":{"Gotham":{"airports":[],"reason":"no_match"}}}

**Agent answer:**

**I couldn't find a "Gotham International Airport" in the FAA data, so I can't compare it with LAX.** The city lookup for "Gotham" returned no match and no close spellings. Gotham is a fictional city, so there's no real airport or traffic data to score.

If you had a real airport in mind, tell me the city or code and I'll run the comparison. For example:
- **New York** (Gotham is often used as a nickname for NYC): JFK, LGA or EWR
- **Another West Coast peer** for LAX, such as SFO, SAN or SEA

I can also score **LAX on its own** against all U.S. airports if that's useful.
