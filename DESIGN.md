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
  - *Unmet demand* 0.30 — load factor = passengers ÷ seats (BTS T-100, latest 12 months). Boeing/Belobaba spill: turned-away demand becomes material above ~80–85% load. The profit the capacity captures. **Sub-score = the load factor as a percentage** (81.9% scores 81.9), capped at 100 (see "Percent scale" below).
  - *Long-haul share* 0.20 — international seats ÷ total seats (BTS T-100 (latest 12 months); international = total − domestic). Revenue quality (weight-based fees, FIS "gateway moat").
  - *Growth* 0.20 — enplanement 5-year CAGR, CY2019→CY2024, in **% per year** (FAA data). Durability of demand. No fallback: an airport without a CAGR has growth *missing* (see "Growth unit" below).
- **Normalization:** `100 × (x − min)/(max − min)`, winsorized at 5th/95th percentile, bounds fixed to the full US dataset so scores are stable and comparable. This is the default (`scale: "minmax"`) for congestion, long-haul and growth. A KPI that is already a percentage uses `scale: "percent"` instead (next bullet).
- **Percent scale (unmet demand):** a KPI definition can set `scale: "percent"` (`KpiDef` in `engine.ts`): the sub-score is the raw percentage itself, clamped to 0–100 and rounded to one decimal, with no winsorizing and no min-max. Unmet demand uses it, so a load factor of 81.7% scores 81.7. **Why:** min-max rescales to the compared set, and with two airports that is all-or-nothing (LAX 81.9% vs. SNA 79.3% would be 100 vs. 0, though both are about 80% full). A load factor already has a natural 0–100 meaning, and the ~80–85% spill threshold above is stated on that same scale, so the number should not depend on which airports are compared. It gives the same sub-score in relative and absolute mode. **Cap:** load factor can exceed 100% in T-100 data (1 of the airports in `data/t100.json`, ODW, is at 108.3%, from reported passengers above reported seats), so the sub-score is capped at 100 and the evidence sentence says so. Missing stays `null` (weights renormalized, as for any KPI). The option is generic: another percentage KPI can use it without special-case code.
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

### The agent: classify, then a ReAct tool loop (#48)

1. **Classify** the message (greeting, capabilities, off_topic, grading, in_scope). `greeting`, `capabilities`
   and `off_topic` get fixed answers (no model call, no tools).
2. **Tool loop (AI, main model)** for `in_scope` and `grading` (`agent/flow/toolLoop.ts`). The LlmClient has no
   native function calling, so the model writes one `{"tool": ..., "input": {...}}` object per step. The agent
   parses the whole step (bare, in a ```json fence or after a lead-in; `agent/toolCall.ts`), runs it through the
   registry tool (`TOOLS`; each tool's zod schema validates the input before its code runs), shows it as a
   `tool_call` / `tool_result` pair, and sends the result back wrapped as `<tool_result>` data, never as instructions.
   - **Tools:** all nine registry tools, `score_airports` and the four per-category tools included. The **scores are always deterministic code**
     (`src/scoring/`); the model only decides which airports to look up and score, then explains.
   - **Scoring rule (the owner's, verbatim in the prompt):** questions about investment potential, or which
     airport is better / should be expanded, MUST go through `score_airports`; the model never ranks from memory.
   - **Category rule (#61, next to the scoring rule):** a question about ONE category ("how congested is JFK?",
     "what is LAX's load factor?", "compare congestion at LAX and SFO") calls that category's tool
     (`get_congestion`, `get_unmet_demand`, `get_long_haul_share`, `get_growth`), not `score_airports`, and the answer
     covers only that category. The tools (`agent/tools/categoryTools.ts`) do no math of their own: each scores the
     airports with the same scorer and `INVESTMENT_KPIS` as `score_airports` and returns that one KPI's breakdown
     (raw value, sub-score, evidence) plus its weight and caveat, so the numbers always match the full score (a golden
     test checks it). They always score against all US airports (`mode: "absolute"`), so a min-max category is never
     all-or-nothing between two airports; a percent-scale category is the same in both modes. At most 5 distinct
     codes (more is `invalid_input`); unknown codes go to `notFound`.
   - **Cap of 5 airports:** `score_airports` with more than 5 distinct codes does not run; it is an `invalid_input`
     error with the problem "max 5 airports; pick the 5 most relevant" (`MAX_SCORED_AIRPORTS` in
     `agent/flow/scoreAirports.ts`), fed back like any other bad call (below).
   - **Tool-call guardrails (#49, `agent/toolCall.ts`, `agent/toolGuard.ts`):** tool JSON is never shown to the user
     (a step is held from its first `{` or backtick until it is parsed), and nothing the model writes is thrown.
     A step is a call attempt when it starts with `{`, or when anywhere in it (after a lead-in, in a fence) there is
     an object with both top-level keys `tool` and `input` in any order, quoted or not, or an object with a `tool`
     key that sits right inside a ``` fence or never closes. Prose that only mentions `{"tool": ...}` (no `input`
     key) is the answer and is shown whole. A trade-off: an answer that starts with `{`, or that quotes a whole
     `{tool, input}` example, is taken as a call attempt and fed back. Calls are strict JSON, so unquoted keys are
     `unparseable` and fed back. A bad
     call is a typed `ToolCallError`: `unparseable` (looks like a call, JSON does not parse), `bad_shape` (not exactly
     `{"tool": string, "input": object}`), `unknown_tool`, `invalid_input` (the tool's zod schema or the 5-airport rule),
     `tool_failed` (the tool returned a `ToolError`) or `repeat_call` (the same tool and input as earlier in the turn,
     keys order-insensitive). Each one shows as a failed tool card, and the model gets a delimited
     `TOOL_CALL_ERROR ... END_TOOL_CALL_ERROR` block with the code, the problem, the expected input JSON Schema (for
     `unknown_tool` and unreadable calls: every allowed tool with its schema) and its own previous call, and nothing
     else from the user. Every model-controlled value in the block (tool name, raw text, problem, error message,
     the previous call) is one JSON string literal capped at `MAX_ECHO_CHARS = 200` chars plus `…[truncated]`, so
     it holds no line break, cannot forge the end marker, and keeps the block bounded; the card name and message are
     capped the same way. A `not_found` is not retried: the model is told the data does not exist and to say so.
     `repeat_call` only covers calls with a final result (a success or a `not_found`), so a call that failed as
     `unavailable` or `internal` may be retried (it still counts toward the retry and step caps).
     The model may retry at most `MAX_INVALID_RETRIES = 2` times in a row; at the 3rd invalid attempt in a row tools
     are switched off (`TOOLS_DISABLED`) and the model answers in prose, or a plain sentence is shown.
   - **Step cap:** at most 6 tool attempts (invalid ones and retries count), then one call that must answer in prose;
     if it still does not, a plain "limit reached" sentence. The answer is never empty. An abort stops at once.
   - **Memory (#50)** is keyed ONLY by the optional `conversationId` in `ChatRequest` (the web app mints one per
     chat with `crypto.randomUUID()`, or a UUID v4 from `crypto.getRandomValues` over plain http; the server requires 16-64 characters of `[A-Za-z0-9_-]`, so the id is an unguessable bearer secret); never by message content, so two chats that start with the same text never
     share data. With no id there is no memory at all (no reads, no writes). Per chat it keeps the tool results by
     airport code (`get_enplanements`, `get_airport_by_code`, the per-airport `score_airports` entries), a focus
     stack and the last ranked list (`agent/memory/conversationMemory.ts`). Each turn, `resolveFocus` +
     `selectFocusedRecords` pick at most 4 records (the codes named or referred to, then the recent focus) and
     they go into the loop's system prompt as "Airport data in focus". A `get_enplanements` or `score_airports`
     call with the same airport codes as an earlier one in the chat returns the cached output without running
     the tool (no re-fetch). **Bounds:** at most 200 chats (least recently used evicted), 1 hour TTL since the
     chat's last turn, 50 airport records and 20 cached outputs per chat. It is in-process: a restart forgets it. The cache sits INSIDE the guard (it wraps `tool.run`, which `runGuarded` calls last), so a cached call is still checked for `unknown_tool`, `repeat_call` and `invalid_input` first, and a cache hit is an ordinary success: it is recorded in the turn's `seen` set once, so asking for it again in the same turn is a `repeat_call`, while the same call in a later turn (new `seen`) is served from the cache with no error and no retry.

This replaced #42's fixed candidates -> resolve -> score pipeline: the owner chose one model-driven loop, with
the 5-airport cap and the scoring rule as the guardrails.

Two **skills** (Markdown in `agent/skills/`) are in the loop's system prompt:
- **Grading** (`grading.md`, for the `grading` label): explains how airports are scored, in the owner's plain-language wording. Its How/Status lines are tested against `INVESTMENT_KPIS`.
- **Compare** (`compare.md`, always, framed as "how to compare and format when score_airports returns 2-5 airports"): verdict first, why (largest contribution gaps), trade-offs, honesty about mode and coverage. It does not retype the score table, and its one `compare` fence example is checked against the web's compare parser.

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
