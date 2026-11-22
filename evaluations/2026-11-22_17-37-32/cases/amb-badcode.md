# amb-badcode

- **Group:** G10-unknown
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Says XYZ is not found",
    "Offers to help with a valid code"
  ],
  "mustNot": [
    "Invent data for XYZ"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Tell me about airport XYZ.

- **Classified as:** in_scope
- **Tools called:** `get_airport_by_code({"code":"XYZ"})`
  - get_airport_by_code → ok: {"error":"not_found"}

**Agent answer:**

I couldn't find an airport with the code **XYZ** in the FAA enplanement data. Either the code is wrong, or it belongs to an airport that isn't in this dataset. The dataset covers U.S. airports with FAA enplanement records, so a very small private field or a non-U.S. airport wouldn't appear.

A few ways to move forward:

- **Check the code.** It may be a typo, for example a similar-looking 3-letter code.
- **Give me the city or metro area.** I can look up the airports that serve it, such as "Austin" or "Bay Area."
- **Give me a region.** I can list airports across a region like the Southeast, Mountain West or Pacific Northwest, then score them for investment potential.
- **Avoid 4-letter ICAO codes** (like "KXYZ"). The data uses 3-letter FAA/IATA codes, so please use that format.

Which airport or area did you have in mind?
