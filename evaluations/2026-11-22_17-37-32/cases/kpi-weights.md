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

- **Classified as:** in_scope
- **Tools called:** `score_airports({"airport_codes":["ATL"]})`
  - score_airports → ok: {"mode":"absolute","ranking":[{"airportCode":"ATL","name":"Hartsfield/Jackson Atlanta International","score":91.1,"coverage":1,"missing":[],"breakdown":{"congestion":{"label":"Congestion / capacity pressure","weight":0.3,"available":true,"subScore":100,"contribution":30,"evidence":{"formula":"annual departures (operations), BTS T-100 (latest 12 months) — proxy for capacity pressure (true form: ope…

**Agent answer:**

# Why congestion gets 30% of the score

The tool doesn't document why it chose 30%. It is a fixed methodology choice, not a weight fitted to historical investment returns. Below is the reasoning the scoring framework implies, using Atlanta (ATL) as an example.

## The intended logic

The score asks one question: **would adding capacity here pay off?** Expansion only pays where current capacity is actually limiting traffic. So the weights split into two groups:

| Category | Weight | What it measures |
|---|---|---|
| Congestion (operations) | 30% | Is the airfield busy? |
| Unmet demand (load factor) | 30% | Are planes full, so passengers get turned away? |
| Long-haul share | 20% | How profitable is the traffic? |
| Growth (5-yr CAGR) | 20% | Will demand keep rising? |

- **Congestion and unmet demand (60% together)** are the main signals that capacity is limiting traffic right now. Each gets the top weight.
- **Long-haul share and growth (20% each)** adjust the score for how profitable the traffic is and whether demand will last. They don't show directly that capacity is needed.

## A key limitation

The tool says congestion should ideally be **operations ÷ ASV** (annual service volume, the airfield's practical capacity). The FAA doesn't freely publish ASV, so the tool uses **raw departures** as a stand-in.

For ATL that means:

- 393,351 departures earns a congestion sub-score of **100**.
- That figure shows ATL is busy. It doesn't show how close ATL is to its actual capacity.

So the 30% weight partly rewards **airport size** rather than capacity pressure. A large airport with plenty of runway capacity can score high on congestion. A mid-size airport near its limits can score low. That is the main reason to question giving this proxy 30%.

## How much the weight matters for ATL

Using the tool's ATL sub-scores, I recalculated the score by hand:

- **Current weights:** 30 + 29.9 + 20 + 11.2 = **91.1**
- **Congestion cut to 20%, growth raised to 30%:** 20 + 29.9 + 20 + 16.8 = **86.7**

ATL stays strong either way because its load factor (82.2%) and international share (13.6%) are high. Its weakest area is growth: −0.4% per year from 2019 to 2024, and 2024 passengers were about 98% of the 2019 level. Raising the growth weight exposes that weakness.

## Bottom line

The 30% reflects a judgment that a busy airfield is one of the two strongest signals that expansion will pay off. But the busyness measure is volume-based, so treat a high congestion sub-score as a reason for further checks, such as FAA capacity studies or delay data, rather than proof.

The tool doesn't let me change its weights. I can recompute scores by hand under different weightings for any set of airports if you'd like to test how sensitive a ranking is.
