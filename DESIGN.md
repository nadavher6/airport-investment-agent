# Design / Architecture

> Living document. Fill in as the implementation develops.

## 1. Scoring methodology

_How do we decide an airport is a strong investment candidate?_

- Candidate KPIs: congestion (operations vs. capacity), passenger throughput growth,
  unmet demand (demand estimate − served capacity), share of long-haul flights, delay rates.
- Proposed composite score: weighted sum of normalized KPIs → "Investment Attractiveness Score".
- _TODO: define exact weights and normalization._

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

- _TODO: list data gaps, proxy metrics, and what "unmet demand" is estimated from._
- **Enplanements** (`data/enplanements.json`, FAA CY2015–CY2024): each year's figure is taken from that year's own
  FAA file, even where the FAA later revised it (4 cases). Growth is a CAGR: `cagr5yr` is 2019→2024 and `cagr10yr`
  is 2015→2024, which is 9 periods. Missing years stay `null`, never estimated. CY2020 hub types reflect COVID
  traffic. Full rules: `data/raw/SOURCES.md`.
- Enplanements are real FAA data (CY2015–CY2024, 575 airports, 513 of them in CY2024), not mocked: e.g. LAX is a Large hub with 37,760,834 enplanements in CY2024. `getEnplanements(code)` and the `get_enplanements` tool definition read this file; neither is connected to the agent yet.
