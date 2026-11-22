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

I couldn't find an airport with the code **XYZ** in the FAA enplanement data. It may not be a valid 3-letter FAA/IATA code, or it may be an airport outside the dataset.

A few ways I can help:
- **Check the code:** if you meant a similar code, tell me and I'll look it up. Note that 4-letter ICAO codes (like "KLAX") aren't supported; use the 3-letter form ("LAX").
- **Search by place:** give me the city or metro area (e.g., "Denver" or "Bay Area") and I'll find the airports that serve it.
- **Search by region:** e.g., "Pacific Northwest" or "Southeast."

Once we have the right airport, I can pull its passenger traffic, growth and investment score.
