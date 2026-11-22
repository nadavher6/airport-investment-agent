# kpi-congestion

- **Group:** G8-method
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Explains congestion = annual departures (operations) from BTS T-100",
    "Notes true ops÷ASV needs unpublished capacity data"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** How exactly do you measure congestion?

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["ATL"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"ATL","name":"Hartsfield/Jackson Atlanta International","score":91.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: ope…

**Agent answer:**

## How congestion is measured

**What it measures:** Congestion stands for capacity pressure, meaning how close an airfield is to the most flights it can handle. It is **30% of the Investment Attractiveness Score**, tied with unmet demand as the heaviest category.

**The metric used: annual departures (a volume proxy)**
- **Input:** total departures over the latest 12 months, from the BTS T-100 segment data.
- **Ideal formula:** operations ÷ Annual Service Volume (ASV). ASV is the FAA's estimate of how many operations an airport's runways and airspace can handle each year before delays rise sharply. This ratio would show how close to capacity an airport really is.
- **Formula in practice:** ASV figures aren't freely published, so the model uses **raw departure volume** in their place. Busier airfields are assumed to be more prone to congestion.

**Example: Atlanta (ATL)**
- 393,351 departures in the latest 12 months
- Congestion sub-score: **100/100**
- Contribution: 100 × 0.30 = **30 points** of ATL's overall 91.1

**How the sub-score is scaled**
- **One airport:** it is scored against all U.S. airports. ATL has the highest volume, so it gets 100.
- **Two or more airports:** they are scored against each other, so the busiest airport in that group gets 100.

## Limitations

1. **Volume isn't the same as how full the airfield is.** A huge airport with many runways (like ATL or DEN) may have room to spare. A smaller airport with one runway and fewer flights may actually be more constrained. The proxy tends to favor big hubs.
2. **Only departures are counted.** The data covers airline (T-100) departures. It doesn't directly include general aviation, military, or all-cargo traffic, which also use runway capacity.
3. **No peak-hour detail.** Annual totals can hide delays that happen at specific times, such as morning banks of flights or slot-controlled airports like LGA and DCA.
4. **Terminal and gate limits aren't captured.** Many expansion cases depend on gates, security checkpoints, or customs capacity rather than runways. This metric doesn't reflect those.

## How to read the score
- A high congestion score is a sign of heavy demand, not proof that the airport has run out of capacity.
- The signal is stronger when it lines up with a **high load factor** (the unmet demand category). For example, ATL's planes are 82.2% full, which supports the case for added capacity.

I can compare congestion across a specific set of airports for you, which would show how the relative scaling changes the results.
