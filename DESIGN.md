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
  - *Congestion* 0.30 — annual departures/operations (BTS T-100, latest 12 months), a traffic-volume proxy for capacity pressure (a true utilization ratio ops ÷ FAA ASV needs runway-capacity data not freely tabulated).
  - *Unmet demand* 0.30 — load factor = passengers ÷ seats (BTS T-100, latest 12 months). Boeing/Belobaba spill: turned-away demand becomes material above ~80–85% load. The profit the capacity captures.
  - *Long-haul share* 0.20 — international seats ÷ total seats (BTS T-100 (latest 12 months); international = total − domestic). Revenue quality (weight-based fees, FIS "gateway moat").
  - *Growth* 0.20 — enplanement CAGR (FY2019→FY2024), fallback recovery-vs-2019 (FAA data). Durability of demand.
- **Normalization:** `100 × (x − min)/(max − min)`, winsorized at 5th/95th percentile, bounds fixed to the full US dataset so scores are stable and comparable.
- **Aggregation:** weighted linear sum. *Fully compensatory* — a high KPI offsets a low one; geometric mean is the partial-compensability alternative (reported in sensitivity).
- **Coverage/honesty:** the engine renormalizes weights over the KPIs it can actually compute and reports a `coverage` fraction + which KPIs are `missing`.

**All four KPIs are computed** from FAA enplanements + BTS T-100 (latest 12 months) (`data/t100.json`, built by
`apps/server/src/data/t100/build.ts` via the free data.bts.gov Socrata API). An airport in both
datasets reports `coverage = 1.0`; one missing from a source gets `null` for that KPI and the engine
renormalizes over the rest. **Two ranking modes:** comparing **2+ airports** scores them *relative* to
each other (so the comparison differentiates — a big gateway beats a domestic hub on long-haul instead
of both saturating at 100); a **single** airport is scored *absolute* vs. all US airports.

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

- **Scoring proxies & gaps:** *Congestion* uses **annual departures (operations)** as a traffic-volume proxy —
  a true utilization ratio (operations ÷ FAA ASV) needs runway-capacity data that isn't freely tabulated, so
  busier airfields score higher. *Unmet demand* uses **load factor** as a spill proxy; true spill needs
  proprietary booking data. *Long-haul* counts international seats only (nonstop T-100, no connecting itineraries).
  Weights are a documented judgment (Need 0.60 / Quality 0.40), to be sensitivity-tested, not optimized. Min-max is
  outlier-sensitive and the count KPIs are right-skewed → **absolute** scoring saturates big hubs at the caps; the
  **relative** mode (bounds from the compared set) is used for 2+ airports so comparisons differentiate.
- **BTS T-100** (`data/t100.json`, latest trailing 12 months, ~1,300 airports; refreshed by `npm run data:build-t100`): nonstop-segment data; `international = total − domestic`.
- **Enplanements** (`data/enplanements.json`, FAA CY2015–CY2024): each year's figure is taken from that year's own
  FAA file, even where the FAA later revised it (4 cases). Growth is a CAGR: `cagr5yr` is 2019→2024 and `cagr10yr`
  is 2015→2024, which is 9 periods. Missing years stay `null`, never estimated. CY2020 hub types reflect COVID
  traffic. Full rules: `data/raw/SOURCES.md`.
- Enplanements are real FAA data (CY2015–CY2024, 575 airports, 513 of them in CY2024), not mocked: e.g. LAX is a Large hub with 37,760,834 enplanements in CY2024. `getEnplanements(code)` and the `get_enplanements` tool definition read this file; neither is connected to the agent yet.
