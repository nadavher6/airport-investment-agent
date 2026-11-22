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

- **Classified as:** grading
- **Tools called:** (none)

**Agent answer:**

**Congestion is measured by annual departures (flight operations) from BTS T-100 data for the latest 12 months.** It is a traffic-volume stand-in for how full the airfield is.

### Why a proxy
- **The ideal measure** is actual flights ÷ the flights the airport was built to handle. Near or over 100% means congested. The FAA starts planning expansion at 60% full and builds at 80%.
- **The limitation:** runway capacity (Annual Service Volume, ASV) isn't freely published, so the model uses raw departure volume instead. A busy airport with lots of spare runway capacity can look more congested than it really is, and a smaller airport near its limits can look less congested.

### How it becomes a score
1. **Trim outliers:** departures are winsorized at the 5th and 95th percentiles, so one giant airport doesn't flatten everyone else.
2. **Scale to 0–100 with min-max scaling:**
   - When you compare 2 or more airports, 100 is the busiest of that set.
   - When you score a single airport, it is compared with all U.S. airports.
3. **Weight it:** congestion carries **30%** of the final score. Together with unmet demand (load factor, also 30%), it forms the "Need" side of the model.

If you'd like, I can show how congestion plays out for specific airports, or explain the other categories.
