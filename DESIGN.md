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
  - *Growth* 0.20 — enplanement 5-year CAGR, CY2019→CY2024, in **% per year** (FAA data). Durability of demand. No fallback: an airport without a CAGR has growth *missing* (see "Growth unit" below).
- **Normalization:** `100 × (x − min)/(max − min)`, winsorized at 5th/95th percentile, bounds fixed to the full US dataset so scores are stable and comparable.
- **Aggregation:** weighted linear sum. *Fully compensatory* — a high KPI offsets a low one; geometric mean is the partial-compensability alternative (reported in sensitivity).
- **Coverage/honesty:** the engine renormalizes weights over the KPIs it can actually compute and reports a `coverage` fraction + which KPIs are `missing`.
- **Deterministic order:** the ranking sorts by score descending, then by airport code ascending (plain code-point order, not locale), so equal scores (common: scores are rounded to 0.1, and many tiny airports score 0) always come out in the same order, whatever order the codes were given in.
- **Input:** `score_airports` upper-cases and dedupes the codes (`LAX` and `lax` are one airport) and accepts at most 50 per call (more is an `invalid_input` error).

**Growth unit: % per year (5-year CAGR), and nothing else.** The FAA dataset has two growth fields: `cagr5yr`
(% per year, CY2019→CY2024) and `recoveryVs2019` (latest year ÷ CY2019, a total change over however many
years the airport has data). Earlier the score used CAGR and fell back to `(recoveryVs2019 − 1) × 100` for the
29 airports without a CAGR, putting a total change and a yearly rate on one scale (FNL got +332 "growth"
against other airports' few % per year). We chose CAGR only, because: it is the standard unit for growth and
the one 493 of 575 airports have; the recovery ratio cannot be turned into a yearly rate for most of those 29
(their latest FAA year is 2019, so the span is zero years; the rest stop in 2020–2023, so even an annualised rate
would cover a different, stale window). Those 29 airports, and the 53 with neither field, get growth = `null`,
the engine lists `growth` in `missing` and their `coverage` drops to 0.8 (or lower). Code:
`growthPctPerYear` in `apps/server/src/scoring/investmentScore.ts`.

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

### The in-scope flow: candidates -> lookup -> score -> explain

1. **Classify** the message (greeting, capabilities, off_topic, grading, in_scope). Only `in_scope` continues below.
2. **Candidates (AI, fast model):** one call returns strict JSON `{ codes, cities, region, intent }` (zod-checked, one retry, then "no candidates"). The model only names places; it never scores. `intent` picks the path (#48): `"score"` (rank, compare, find candidates) continues with steps 3-6 below; `"lookup"` (traffic, passengers, codes, "what airports serve...") goes to **the tool loop** below. A missing intent or a failed candidate step also goes to the loop ("when unsure, the loop").
3. **Lookup (deterministic):** `get_airport_by_code`, `find_airports_by_city` and `find_airports_by_region` confirm and expand them. Unknown codes are dropped, and a failed lookup is reported as a failed lookup, not as a wrong code. Model-returned codes are never copied into the answer model's instructions.
4. **Cap:** at most 5 airports are scored (`MAX_SCORED_AIRPORTS` in `agent/flow/resolve.ts`; the owner can change it). Airports named in the question are kept first; free slots go to the busiest (latest enplanements) airports of the named places. The answer says when the cap cut the list.
5. **Score (deterministic):** the real `score_airports` tool. Every step is shown as a `tool_call` / `tool_result` pair.
6. **Explain (AI, main model):** the results are in the system context; the model explains them and does not invent numbers.

### The lookup path: the tool loop (#48)

For `in_scope` questions that are not scoring questions, the main model runs a small ReAct loop
(`agent/flow/toolLoop.ts`). The LlmClient has no native function calling, so the model writes one
`{"tool": ..., "input": {...}}` object per step. The agent parses the whole step (bare, in a ```json fence or
after a lead-in; `agent/toolCall.ts`), runs it through the registry tool (`getTool`, whose zod schema validates
the input before the tool's code runs), shows it as a `tool_call` / `tool_result` pair, and sends the result back
wrapped as `<tool_result>` data, never as instructions.
- **Tools:** `get_airport_by_code`, `find_airports_by_city`, `find_airports_by_region` and `get_enplanements`.
  `score_airports` is not a loop tool: if the model asks for it, the turn goes to the scoring flow above, so the
  5-airport cap always applies.
- **Guard (minimal):** tool JSON is never shown to the user (a step is held from its first `{` or backtick until
  it is parsed). An unreadable call or an unknown tool is fed back once; a second one ends the turn with a plain
  sentence. #49 replaces this with the full policy.
- **Cap:** at most 6 tool runs, then one call that must answer in prose; if it still does not, a plain
  "limit reached" sentence. The answer is never empty.
- **Memory** is not wired in yet (a follow-up: it needs a conversation id in the contract).

Two **skills** (Markdown in `agent/skills/`) are added to the system context when they apply:
- **Grading** (`grading.md`, for the `grading` label, no tools): explains how airports are scored, in the owner's plain-language wording. Its How/Status lines are tested against `INVESTMENT_KPIS`.
- **Compare** (`compare.md`, when 2-5 airports were scored): verdict first, why (largest contribution gaps), trade-offs, honesty about mode and coverage. It does not retype the score table, and its one `compare` fence example is checked against the web's compare parser.

## 4. Assumptions & limitations

- **Scoring proxies & gaps:** *Congestion* uses **annual departures (operations)** as a traffic-volume proxy —
  a true utilization ratio (operations ÷ FAA ASV) needs runway-capacity data that isn't freely tabulated, so
  busier airfields score higher. *Unmet demand* uses **load factor** as a spill proxy; true spill needs
  proprietary booking data. *Long-haul* counts international seats only (nonstop T-100, no connecting itineraries).
  Weights are a documented judgment (Need 0.60 / Quality 0.40), to be sensitivity-tested, not optimized. Min-max is
  outlier-sensitive and the count KPIs are right-skewed → **absolute** scoring saturates big hubs at the caps; the
  **relative** mode (bounds from the compared set) is used for 2+ airports so comparisons differentiate.
- **BTS T-100** (`data/t100.json`, latest trailing 12 months, ~1,300 airports; refreshed by `npm run data:build-t100`): nonstop-segment data; `international = total − domestic`. The committed file covers **2025-09 to 2026-08** (1,312 airports). The window is chosen at build time as the newest 12 months BTS has, so a rebuild moves it and changes the scores; the window is recorded in `meta.periodStart`/`meta.periodEnd`. Airports are written in code order, so two builds of the same window give the same file apart from `meta.builtAt`.
- **Window mismatch (FAA vs T-100):** growth uses FAA **calendar years** (CY2019→CY2024), while congestion, unmet demand
  and long-haul use T-100's **trailing 12 months** (2025-09 to 2026-08). The two sources also count differently
  (FAA enplanements vs T-100 segment passengers), so for one airport the numbers do not match exactly: ORD's T-100
  passengers are about 10% above its FAA CY2024 enplanements, ATL's about 3% below. Each KPI is compared only with
  the same KPI at other airports, so the mismatch does not mix units, but growth describes an older period than the
  other three.
- **Load factor above 100% is accepted, not capped.** At very small airports T-100 can report more passengers than
  seats (e.g. **ODW: 108.3%, from 2 departures** in the window; it is the only airport above 100%). This is a
  reporting quirk of tiny samples, not real demand. It is kept as reported: in absolute mode the 5th/95th-percentile
  winsorizing already clamps it to the same sub-score as the 95th-percentile airport; in a relative comparison it
  simply tops the load-factor KPI of that set. Capping or dropping it would mean inventing a threshold. Read scores of airports with only a handful
  of departures with care.
- **Enplanements** (`data/enplanements.json`, FAA CY2015–CY2024): each year's figure is taken from that year's own
  FAA file, even where the FAA later revised it (4 cases). Growth is a CAGR: `cagr5yr` is 2019→2024 and `cagr10yr`
  is 2015→2024, which is 9 periods. Missing years stay `null`, never estimated. CY2020 hub types reflect COVID
  traffic. Full rules: `data/raw/SOURCES.md`.
- Enplanements are real FAA data (CY2015–CY2024, 575 airports, 513 of them in CY2024), not mocked: e.g. LAX is a Large hub with 37,760,834 enplanements in CY2024. `getEnplanements(code)` and the `get_enplanements` tool definition read this file; neither is connected to the agent yet.
