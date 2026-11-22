# Design / Architecture

> Living document. Fill in as the implementation develops.

## 1. Scoring methodology

_How do we decide an airport is a strong investment candidate?_ Full research and sources:
[`tasks/06-scoring-formula-research.md`](tasks/06-scoring-formula-research.md).

**Investment Attractiveness Score (0–100)** — a composite indicator built per the OECD/JRC
*Handbook on Constructing Composite Indicators*: **winsorize → min-max normalize → weighted
linear aggregate**, code in `apps/server/src/scoring/`.

```
Score = 0.30·Congestion + 0.30·UnmetDemand + 0.20·LongHaul + 0.20·Growth   (each 0–100)
```

- **KPIs & weights (budget allocation, Need 0.60 / Quality 0.40):**
  - *Congestion* 0.30 — operations ÷ capacity (FAA ASV; thresholds 0.60/0.80/0.95 from FAA Order 5090.x). Where capacity helps.
  - *Unmet demand* 0.30 — Boeing/Belobaba spill: `DemandFactor = LoadFactor + SpillFactor`; proxied by load factor × growth. The profit the capacity captures.
  - *Long-haul share* 0.20 — international/widebody seats ÷ total (BTS T-100). Revenue quality (weight-based fees, FIS "gateway moat").
  - *Growth* 0.20 — enplanement CAGR (FY2019→FY2024) + recovery-vs-2019. Durability of demand.
- **Normalization:** `100 × (x − min)/(max − min)`, winsorized at 5th/95th percentile, bounds fixed to the full US dataset so scores are stable and comparable.
- **Aggregation:** weighted linear sum. *Fully compensatory* — a high KPI offsets a low one; geometric mean is the partial-compensability alternative (reported in sensitivity).
- **Coverage/honesty:** the engine renormalizes weights over the KPIs it can actually compute and reports a `coverage` fraction + which KPIs are `missing`.

**v0 (shipped) vs v1:** v0 computes **Growth** (real) and **Unmet demand** (degraded proxy =
demand magnitude) from the FAA enplanement dataset → `coverage = 0.50`. **Congestion** and
**Long-haul** need a BTS T-100 tool (operations, load factor, international share) = **v1**.

## 2. Key tradeoffs

- Data freshness vs. API rate limits / free tiers.
- Deterministic scoring (transparent, reproducible) vs. LLM flexibility.
- Coverage (all US airports) vs. depth (richer data for a curated set).
- _TODO._

## 3. Where / how AI is used

- AI is used for: parsing the user's natural-language question, selecting which airports/KPIs
  are relevant, and explaining the deterministic results in plain language.
- AI is NOT used for: the actual ranking math — that is deterministic code in `src/scoring/`.
- Provider: Gemini (gemini-3.5-flash) or Claude headless, behind the LlmClient interface.
- _TODO._

## 4. Assumptions & limitations

- **Scoring proxies & gaps (v0):** *Congestion* and *Long-haul* are **not yet computed** (need BTS T-100
  operations/load-factor/international data); each airport's score reports `coverage = 0.50` and lists them as
  `missing`. *Unmet demand* is a **degraded proxy** (latest-year enplanement magnitude), not true spill, which
  needs proprietary booking data; the real v1 uses load factor. *Congestion*'s capacity denominator (FAA ASV) is
  **approximated** (no national ASV table). Weights are a documented judgment (Need 0.60 / Quality 0.40), to be
  sensitivity-tested, not optimized. Min-max is outlier-sensitive → winsorized at 5/95; the big hubs saturate the
  demand proxy at 100 (a known v0 limitation the T-100 KPIs will relieve).
- **Enplanements** (`data/enplanements.json`, FAA CY2015–CY2024): each year's figure is taken from that year's own
  FAA file, even where the FAA later revised it (4 cases). Growth is a CAGR: `cagr5yr` is 2019→2024 and `cagr10yr`
  is 2015→2024, which is 9 periods. Missing years stay `null`, never estimated. CY2020 hub types reflect COVID
  traffic. Full rules: `data/raw/SOURCES.md`.
- Enplanements are real FAA data (CY2015–CY2024, 575 airports, 513 of them in CY2024), not mocked: e.g. LAX is a Large hub with 37,760,834 enplanements in CY2024. `getEnplanements(code)` and the `get_enplanements` tool definition read this file; neither is connected to the agent yet.
