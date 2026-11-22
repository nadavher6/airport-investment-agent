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

I couldn't find **Gotham International Airport** in the data. The city lookup for "Gotham" returned no match and no close spellings. Gotham is the fictional city from Batman comics, so there's no real FAA airport to compare with LAX.

If you meant a real airport, these could be close:
- **New York City airports (JFK, LGA, EWR)**, since "Gotham" is a common nickname for New York.
- **Another specific U.S. airport.** Give me its 3-letter code or the city it serves.

Once you confirm, I'll rank the airports side by side with the Investment Attractiveness Score and passenger data. Or, if you only want LAX, I can score it against all U.S. airports.
