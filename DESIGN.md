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
- Provider: pluggable (Gemini / Groq / OpenRouter).
- _TODO._

## 4. Assumptions & limitations

- _TODO: list data gaps, proxy metrics, and what "unmet demand" is estimated from._
