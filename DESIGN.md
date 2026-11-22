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
  - *Congestion* 0.30 — **runway utilization = annual operations ÷ ASV** (Annual Service Volume), the owner's "flights it handles vs. flights it was built to handle". Operations = BTS T-100 (latest 12 months) departures × 2 (arrivals ≈ departures), accepted by the owner as a **lower bound**: T-100 has no general-aviation or military flights, so the real operations and utilization are higher. ASV = the FAA planning estimate for the airport's runway layout (see "Runway capacity (ASV)" below). **Sub-score = the utilization as a percentage**, capped at 100 (`scale: { kind: "percent", fullAt: 1.0 }`, raw value in percent points): LAX at 86.8% scores 86.8, DEN at 205% scores 100. FAA rule of thumb, quoted in the evidence: plan more capacity at 60%, build at 80%.
  - *Unmet demand* 0.30 — load factor = passengers ÷ seats (BTS T-100, latest 12 months). Boeing/Belobaba spill: turned-away demand becomes material above ~80–85% load. The profit the capacity captures. **Sub-score = the load factor as a percentage** (81.9% scores 81.9), capped at 100 (see "Percent scale" below).
  - *Long-haul share* 0.20 — international seats ÷ total seats (BTS T-100 (latest 12 months); international = total − domestic). Revenue quality (weight-based fees, FIS "gateway moat"). **Sub-score = the international share as a percentage of a benchmark**, capped at 100 (LAX's 30.8% scores 61.6; the benchmark is in "Percent scale" below).
  - *Growth* 0.20 — enplanement 5-year CAGR, CY2019→CY2024, in **% per year** (FAA data). Durability of demand. No fallback: an airport without a CAGR has growth *missing* (see "Growth unit" below).
- **Normalization:** `100 × (x − min)/(max − min)`, winsorized at 5th/95th percentile, bounds fixed to the full US dataset so scores are stable and comparable. This is the default for growth (`scale` omitted, or `{ kind: "minmax" }`). A KPI that is a percentage uses `scale: { kind: "percent", fullAt }` instead (next bullet).
- **Percent scale (congestion, unmet demand, long-haul):** a KPI definition can set `scale: { kind: "percent", fullAt }` (`Scale` and `percentScore` in `engine.ts`). `fullAt` is the share, as a fraction, that scores 100: **sub-score = share ÷ fullAt × 100**, clamped to 0–100 and rounded to one decimal, with no winsorizing and no min-max. The raw values are percent points (LAX load factor 81.9, international share 30.8, runway utilization 86.8), so the engine divides the raw value by 100 and `raw` in the output stays in the familiar percent unit. Three KPIs use it: **congestion** with `fullAt: 1.0` (runway utilization 86.8% scores 86.8; DEN's 205% scores 100), **unmet demand** with `fullAt: 1.0` (a load factor of 81.7% scores 81.7, identical to before) and **long-haul** with `fullAt: 0.5` (an international share of 40% scores 80, LAX 30.8% scores 61.6, SNA 2.1% scores 4.2). Golden tests pin one value per KPI through the real engine (`congestion.test.ts`), so a 100× unit slip fails. **Why:** min-max rescales to the compared set, and with two airports that is all-or-nothing (LAX 81.9% vs. SNA 79.3% load factor would be 100 vs. 0, though both are about 80% full; LAX 30.8% vs. SNA 2.1% international would be 100 vs. 0). A share already has a natural scale, so the number should not depend on which airports are compared; it is the same in relative and absolute mode. Runway utilization is a percentage of capacity, and the FAA's 60%/80% triggers are stated on that scale. **Why 50% for long-haul:** the benchmark is **50% international seats = 100**. It is a deliberate owner choice meaning "an international gateway", not a fitted number. The data shows how demanding it is: of the 1,312 airports in `data/t100.json`, 22 reach 50% and the median is 0%; the 95th percentile is 15.9% (linear interpolation over all 1,312; over the 521 airports the scorer can score, i.e. those with both a FAA enplanements record and a T-100 record, it is 10.5%, same value by nearest rank). For comparison only, other hubs sit at JFK 52.9%, MIA 44.7%, LAX 30.8%, SFO 28.3%, ATL 13.6%, DEN 5.8%. **Caps:** load factor can exceed 100% (ODW is at 108.3%), runway utilization can exceed 100% (15 airports, e.g. ATL 127.9%, DEN 205%; the raw value is kept uncapped) and an international share above 50% scores 100 (20 airports are above it, the largest are small airports where every reported seat is international); the evidence sentence says so. Missing stays `null` (weights renormalized, as for any KPI), and so does NaN. The option is generic: another percentage KPI can use it without special-case code.
- **Runway capacity (ASV), #54.** Source: FAA AC 150/5060-5 *Airport Capacity and Delay* (Change 2), Chapter 2, **Figure 2-1 "Capacity and ASV for long range planning"**, which gives an ASV for 19 runway-use configurations and five mix-index bands. The table is one constant, `FIGURE_2_1_ASV` in `apps/server/src/data/capacity/asv.ts`. Steps (build time, `npm run data:build-capacity`, output `data/capacity.json`):
  1. **Runways** from FAA NASR (`APT_RWY.csv`, `APT_RWY_END.csv`, cycle 2026-10-29): paved runways (ASPH/CONC/PEM); an airport with no paved runway uses its unpaved land runways (Alaskan gravel strips). Helipads, water lanes and rooftop pads are dropped.
  2. **Layout** from the runway-end coordinates: runways within 10° of heading are parallel (in the data no pair falls between 9.5° and 17°, so any cut-off in that gap gives the same groups); centerline spacing is measured; parallels under 700 ft apart count as one runway (Figure 2-1 has no parallel row below 700 ft); runways of different headings either cross or form an open V.
  3. **Configuration:** spacing bands are the figure's: 700–2,499 ft, 2,500–4,299 ft, 4,300 ft+ (the figure's 3,400 ft alternative needs PRM radar, which NASR does not record, so the 4,300 ft line is used). Of all the Figure 2-1 configurations the layout contains, the one with the **highest ASV** is used, as the AC assumes the airport runs its highest-capacity configuration (paragraph 2-3.b) and that any layout is approximated by one of the 19 (2-2.a).
  4. **ASV = the midpoint of that row** ((lowest + highest) / 2), because the mix index (share of large aircraft) needs fleet data no free source tabulates: one runway 217,500 (195,000–240,000); two close parallels 307,500; four parallels in two close pairs 615,000.
  In the committed file 569 of 575 airports map (configuration 9, two intersecting runways, 210; configuration 1, single, 197; open V 65; parallel pairs 75; larger layouts 22). **Missing, never guessed:** 6 airports have no land runway in NASR (ISN closed, PBI renamed DJT in NASR, W33, CGA, KAE, MTM seaplane bases), and an airport whose NASR runways lack end coordinates would be missing too. With T-100 operations missing as well, congestion is missing for 57 of the 575 airports (35 of them have CY2024 FAA data).
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
   - **Answer-scope rule (#64, with the category tools folded in by #61):** a question about ONE factor ("how
     congested is JFK?", "what is LAX's load factor?", "compare congestion at LAX and SFO") calls that factor's tool
     (`get_congestion`, `get_unmet_demand`, `get_long_haul_share`, `get_growth`), not `score_airports`, and the answer
     covers only that factor and offers the rest; a general grade / rank / "compare for investment" question still
     goes to `score_airports` with the full breakdown. It is one persona rule (`ANSWER_SCOPE_RULE`), so it cannot
     contradict a second one. The tools (`agent/tools/categoryTools.ts`) do no math of their own: each scores the
     airports with the same scorer and `INVESTMENT_KPIS` as `score_airports` and returns that one KPI's breakdown
     (raw value with its `unit`, sub-score, evidence) plus its weight and caveat. They are always ABSOLUTE
     (`mode: "absolute"`, scored against all US airports), so they equal `score_airports` with ONE code (a golden test
     checks it). `score_airports` with 2+ codes is relative: it rescales the min-max category (growth) within the
     compared set, so that sub-score can differ (growth LAX 44.1 here, 0 there); the percent-scale categories (unmet
     demand, long-haul) are the same in both modes. A min-max category is never all-or-nothing between two airports. At most 5 distinct
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

- **Runway utilization is approximate (congestion).** (1) The **ASV is a long-range planning estimate** from a 1983
  table (Change 2, 1995) and the row midpoint, not a measured capacity; the real mix index, taxiways, airspace and
  ATC procedures can move it by tens of percent either way. (2) **T-100 has no general-aviation or military flights**,
  and operations are departures × 2, so for most airports utilization is a **lower bound** on that side. (3) At
  **airports with more runways than any Figure 2-1 sketch** (92 airports, e.g. DEN 6 runways vs. the 2-runway
  configuration it matches, ORD 8 vs. 4, DFW 7 vs. 4), the ASV is understated and the utilization overstated
  (DEN 205%, ORD 145.3%); the evidence sentence says so. 15 airports are above 100% and score the capped 100, so
  congestion does not separate the largest hubs from each other. Check a high utilization against the runway list
  in the evidence before relying on it.
- **Scoring proxies & gaps:** *Unmet demand* uses **load factor** as a spill proxy; true spill needs
  proprietary booking data. *Long-haul* counts international seats only (nonstop T-100, no connecting itineraries), scored out of a 50% benchmark.
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
