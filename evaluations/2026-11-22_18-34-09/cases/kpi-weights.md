# kpi-weights

- **Group:** G8-method
- **Turns:** 1

## Expected (rubric for the judge)
```json
{
  "classification": "in_scope",
  "answerCriteria": [
    "Explains the Need 0.60 / Quality 0.40 split",
    "Honest that weights are a judgment"
  ]
}
```

## Transcript (what the agent actually did)

### Turn 1
**User:** Why do you weight congestion at 30%?

- **Classified as:** grading
- **Tools called:** (none)

**Agent answer:**

**Congestion gets 30% because it is half of the "Need" side of the model. Need (Congestion + Unmet demand) carries 60% of the score, and Quality (Long-haul + Growth) carries 40%.**

### The reasoning in the grading design
- **Congestion asks "Is this airport too full?"** Adding capacity helps most at an airport that is already packed. The FAA uses the same logic: it starts planning expansion when an airport reaches about 60% of capacity and builds at about 80%.
- **Need is weighted above Quality.** Congestion and unmet demand show whether expansion is needed now. Long-haul share and growth show how valuable and durable the traffic is. The model treats need as the primary signal and quality as a modifier.
- **Need is split evenly.** Congestion and unmet demand get 30% each. Long-haul and growth get 20% each.

### Caveats
- **The 30% is not derived from data.** The grading documentation gives the Need/Quality split but no deeper reason for 30% rather than, say, 25% or 35%. It is a design choice.
- **Congestion is measured by a proxy.** The ideal measure is flights handled ÷ runway capacity, but FAA runway capacity (ASV) data is not freely published. The model uses annual departures from BTS T-100 (latest 12 months) instead. That captures how busy an airport is, not how close it is to its limit. So a large airport with plenty of spare runway capacity can still score high on congestion.

I can also explain how the other categories are scored, or score specific airports if you'd like to see congestion's effect in practice.
