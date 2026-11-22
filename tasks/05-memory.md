# Task 5 — Conversation Memory (follow-ups without context bloat)

> **Goal:** Give the agent memory so the user can ask **follow-up questions and discuss
> the data already presented** ("why is it higher?", "add Boston", "explain the second
> one's unmet demand"), while **never overwhelming the LLM with irrelevant data**.
>
> **Depends on:** #9 (`LlmClient`, `LlmPassthroughAgent`) and #13 (`classifyMessage`).
> Area: `agent`. Build on a branch from #13's head.

---

## 1. The core idea — separate "what was said" from "what was shown"

Naive memory replays the full transcript, including large JSON tool outputs, back into
the prompt every turn. That is exactly what overwhelms the model. Instead, split memory
into **two stores** and inject from each **selectively**:

```
┌─ Conversation memory (dialogue) ────────┐   ┌─ Working set (structured data) ──────────┐
│ last N turns of text                    │   │ Map<airportCode, AirportRecord>          │
│ + 1-line rolling summary of older turns │   │   (the actual tool results, by code)     │
└─────────────────────────────────────────┘   │ focusStack: airportCode[] (recent first) │
                                               └──────────────────────────────────────────┘
```

- **Conversation memory** = the chat itself (short window + a tiny rolling summary).
- **Working set** = the structured data the tools returned, **keyed by airport code**,
  *never* pasted into the transcript as text.

### Why no vector DB / embeddings

This domain's data is keyed by a **bounded entity (airport code)**. "Relevance" is an
**entity-resolution problem, not semantic search.** Scoping by code is simpler, exact,
and cheaper than embeddings — and it matches the project's deterministic ethos
(`DESIGN.md`). No RAG needed.

---

## 2. How the classifier (#13) gates memory

`classifyMessage` already runs **first** on every message and returns `{ label, reason }`.
Memory hangs off that label — and this is half of the "don't overwhelm" solution,
because **3 of 4 labels never load airport data**:

| Label | Data memory | What happens |
|---|---|---|
| `greeting` | ❌ untouched | Canned/simple reply. Turn stored in dialogue memory only. |
| `capabilities` | ❌ untouched | Describe the agent. Dialogue memory only. |
| `off_topic` | ❌ untouched | Decline/redirect (incl. prompt-injection attempts). Dialogue only. |
| `in_scope` | ✅ full pipeline | Resolve focus → fetch/reuse → assemble focused context → answer. |

> Net effect: a "hi" or "what can you do?" never drags airport records into context, and
> an `off_topic` injection attempt never reaches the data layer. The memory pipeline in
> §4–§6 only runs on `in_scope`.

---

## 3. Data structures (`apps/server/src/agent/memory/types.ts`)

```ts
/** One airport's data as returned by the tools, cached for reuse. */
export interface AirportRecord {
  airportCode: string;
  // whatever the tools return, stored verbatim so follow-ups stay numerically consistent
  airport?: AirportSummary; // from the #23 lookups (get_airport_by_code, find_airports_by_city/region)
  enplanements?: unknown;   // from get_enplanements (Task 3)
  fetchedAtTurn: number;    // turn index when first/last fetched
  lastReferencedTurn: number;
  source: string[];         // e.g. ["AirLabs", "FAA CY15-CY24"]
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;          // text only — NO embedded JSON blobs
  turn: number;
}

export interface ConversationMemory {
  turns: ConversationTurn[];      // full log (server-side); windowed on assembly
  rollingSummary: string;         // 1–2 lines compressing turns older than the window
  summarizedUpToTurn: number;
}

export interface Memory {
  conversation: ConversationMemory;
  workingSet: Map<string, AirportRecord>;
  focusStack: string[];           // airport codes, most-recently-referenced first
  turnCounter: number;
}
```

Scope: **one `Memory` per conversation**, held server-side (keyed by conversation id).
It is not part of the `@airport/shared` wire contract — it's server-internal state.

---

## 4. Focus & reference resolution (the "which airports" step)

Runs only on `in_scope`. Produces the **target codes** for this turn. Deterministic
first, LLM only as a fallback:

1. **Explicit extraction** — regex for 3-letter codes (`\b[A-Z]{3}\b` filtered against the
   known-airport set) + a small **region gazetteer** ("Pacific Northwest" → {SEA, PDX, …}).
2. **Anaphora via focus stack** — if the message has references but no explicit entity
   ("it", "that one", "the second", "them", "compare it with Denver"), resolve against
   `focusStack`:
   - "it / that airport" → `focusStack[0]`
   - "the second one / the top one" → ordinal into the last presented list
   - "them / both" → the last presented set
3. **Fallback** — if still ambiguous, don't guess: the focused context (names + ranks)
   is in the prompt anyway, so let the main LLM disambiguate, or ask a clarifying question.

Then **update `focusStack`**: move this turn's target codes to the front; keep it
de-duplicated.

> Reference resolution does **not** need a new LLM call for the MVP — regex + focus
> stack covers the common cases. An optional tiny LLM resolver can be added later for
> messy anaphora (see §10 Full-design extras).

---

## 5. Fetch vs. reuse

For each target code:

- **In working set and fresh enough** → reuse the cached `AirportRecord` (no tool call).
  Keeps numbers consistent across follow-ups and avoids re-hitting AirLabs.
- **Missing, or a `MODIFY` that needs new data** → let the agent call the tools
  (`get_enplanements`, the #23 lookups), then **store the result by code** and set
  `fetchedAtTurn`.

Freshness policy: `enplanements` (annual) and the `airport` lookup never go stale within
a session — reuse within the session is fine for a conversation.

---

## 6. Context assembly — the relevance filter (prevents overwhelm)

Build the LLM prompt for an `in_scope` turn as:

```
system prompt
+ rollingSummary                      (1–2 lines, older context)
+ last N dialogue turns               (text only, no JSON)         N ≈ 4–6
+ focused data block                  ONLY records for (explicit ∪ top-K focusStack)
+ current user message
```

**Relevance budgeting (the knobs):**

- **K-cap:** inject at most **K** airport records (e.g. K = 4), chosen by explicit
  mention first, then focus-stack recency. A 10-airport working set still injects ≤ K.
- **Field projection:** if the turn is about one dimension ("why is its *congestion*
  high?"), inject the congestion-relevant fields, not the whole record. (Optional; start
  by injecting whole records for the ≤ K focused airports.)
- **Compact serialization:** minified JSON or a small table, not pretty-printed blobs.
- **Text-only dialogue:** the windowed turns carry the *conversation*, never the raw
  tool payloads — those live only in the working set and are injected via the focused
  block above.

This is the whole trick: **continuity comes from the structured working set + focus
stack; the small prompt comes from injecting only the focused subset.**

### 6.1 Where memory actually enters the prompt

The agent talks to the model through `LlmClient` (#9), whose input is a **messages
array** (`{ role, content }[]`). Memory is injected in **two distinct seams** — and it
matters which goes where:

```
messages = [
  { role: "system", content: SYSTEM_PROMPT + "\n\n" + MEMORY_CONTEXT_BLOCK },   ← seam A
  ...windowedTurns,                                                              ← seam B
  { role: "user", content: currentUserMessage },
]
```

- **Seam A — the system message** carries the *retrieved* memory that is **not literal
  dialogue**: the `rollingSummary` and the **focused data block** (the ≤ K airport
  records). This is context the agent should treat as reference, not as something "the
  user said", so it belongs in the system role.
- **Seam B — the windowed turns** are the last N real `{role, content}` dialogue turns,
  replayed verbatim as messages. This is the *conversation*, text-only, **no JSON**.

> For the Claude-headless provider, `MEMORY_CONTEXT_BLOCK` is passed via
> `--append-system-prompt`; for Gemini it's prepended to the system instruction. Either
> way `LlmClient` hides the provider difference — the memory layer just hands it the
> system text + messages.

### 6.2 An actual rendered prompt (Turn 7 of §8: "and the second one's unmet demand?")

This is the **literal content** sent to the model on that turn. Note what's present and
what's deliberately absent (LAX and SFO full records are *not* here — only DEN's
projected unmet-demand fields):

**`messages[0]` — system (SYSTEM_PROMPT + injected `MEMORY_CONTEXT_BLOCK`):**

```text
You are an airport investment analyst assistant. You rank US airports for
modernization/expansion using deterministic metrics. Explain results from the data
provided; never invent figures. [...rest of the owner's system prompt...]

## Conversation memory
Summary of earlier discussion:
Compared LAX, SFO, DEN for investment; LAX ranked highest on congestion and long-haul.

## Airport data in focus (use only this data; do not fabricate)
{"DEN":{"airportCode":"DEN","unmet_demand_pct":2.1,"capacity_position":"just under target capacity","source":["AirLabs","FAA CY15-CY24"]}}
```

**`messages[1..N]` — the windowed dialogue turns (text only):**

```jsonc
[
  { "role": "user",      "content": "Compare LAX and SFO for investment potential." },
  { "role": "assistant", "content": "LAX scores 61.3 vs SFO 50.9. LAX runs above capacity..." },
  { "role": "user",      "content": "why is it higher?" },
  { "role": "assistant", "content": "LAX is higher because it's ~16 flights/day over target capacity..." },
  { "role": "user",      "content": "add Denver to the comparison" },
  { "role": "assistant", "content": "Updated ranking: LAX 61.3 > DEN 57.4 > SFO 50.9..." }
]
```

**`messages[last]` — the current user message:**

```jsonc
{ "role": "user", "content": "and the second one's unmet demand?" }
```

> The off-topic Turn 6 ("weather in Denver") is **not** in the window here (it fell
> outside N, and carried no data anyway). DEN's record appears **once**, in seam A,
> projected to just the asked-about fields — the LLM has exactly what it needs and
> nothing else.

### 6.3 The assembly function (where the seams are built)

```ts
// apps/server/src/agent/memory/assemble.ts
import type { Memory } from "./types";
import type { ChatMessage } from "@airport/shared";

const N = 4;   // dialogue window
const K = 4;   // max injected airport records

export function assembleMessages(
  systemPrompt: string,
  memory: Memory,
  focusCodes: string[],              // from §4 resolution (explicit ∪ top-K focus)
  currentUserMessage: string,
  projectFields?: (rec: unknown) => unknown,   // §6 field projection (optional)
): ChatMessage[] {
  // --- seam A: retrieved memory -> system block ---
  const focused = focusCodes
    .slice(0, K)
    .map((code) => memory.workingSet.get(code))
    .filter(Boolean)
    .map((rec) => (projectFields ? projectFields(rec) : rec));

  const focusedById = Object.fromEntries(
    focused.map((r: any) => [r.airportCode, r]),
  );

  const memoryBlock = [
    memory.conversation.rollingSummary &&
      `## Conversation memory\nSummary of earlier discussion:\n${memory.conversation.rollingSummary}`,
    focused.length &&
      `## Airport data in focus (use only this data; do not fabricate)\n${JSON.stringify(focusedById)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const systemContent = memoryBlock ? `${systemPrompt}\n\n${memoryBlock}` : systemPrompt;

  // --- seam B: last N dialogue turns, text only ---
  const windowed: ChatMessage[] = memory.conversation.turns
    .slice(-N * 2) // N user+assistant pairs
    .map((t) => ({ role: t.role, content: t.content }));

  return [
    { role: "system", content: systemContent },
    ...windowed,
    { role: "user", content: currentUserMessage },
  ];
}
```

Key properties visible in the code:
- **Working-set records never enter seam B** — they're only serialized into seam A, and
  only for `focusCodes` (≤ K). A greeting/capabilities/off_topic turn calls this with
  `focusCodes = []`, so the memory block is empty.
- **`rollingSummary`** is the only trace of turns older than the window.
- **`projectFields`** trims a record to the asked-about dimension (Turn 7).

### 6.4 Where it's called (the wiring in `LlmPassthroughAgent`)

```ts
// inside the agent run, AFTER classifyMessage (#13)
const { label } = await classifyMessage(client, recentTurns, signal);

let focusCodes: string[] = [];
let project: ((r: unknown) => unknown) | undefined;

if (label === "in_scope") {
  focusCodes = resolveFocus(userMessage, memory);          // §4
  await ensureFetched(focusCodes, memory, signal);         // §5 (reuse or tool-call)
  project = dimensionProjector(userMessage);               // §6 field projection (optional)
}
// greeting / capabilities / off_topic -> focusCodes stays [] -> empty memory block

const messages = assembleMessages(SYSTEM_PROMPT, memory, focusCodes, userMessage, project);
const stream = client.chat(messages, { signal });          // the actual LLM call
// ...stream events, then commit the turn to memory (§7 step 5-6)
```

---

## 7. Per-turn flow (end to end)

```
user message
  │
  ├─ classifyMessage (#13) ──────────────► {label, reason}   (shown as classify_message tool step)
  │
  ├─ label ∈ {greeting, capabilities, off_topic}
  │     └─ respond directly; append turn to conversation memory; STOP (no data touched)
  │
  └─ label == in_scope
        1. resolve focus (§4)  → target codes, update focusStack
        2. fetch vs reuse (§5) → ensure working set has target records
        3. assemble context (§6) → system + summary + last N turns + focused block
        4. LLM answers (streamed via existing events)
        5. append user+assistant turns; mark lastReferencedTurn on used records
        6. if turns beyond window → fold oldest into rollingSummary
```

---

## 8. Worked example — a full conversation showing memory

Walkthrough settings: **N = 4** (dialogue window), **K = 4** (max injected records).
`WS` = working set, `FS` = focus stack. **"Injected data block"** = the airport data
that actually reaches the LLM that turn (the relevance filter, §6). Watch it stay empty
on non-data turns and hold only the *focused* subset on data turns.

### Turn 1 — greeting
**User:** `hey there`
- **classify →** `{ label: "greeting", reason: "Simple salutation." }`
- Branch: greeting → **data memory untouched**; no focus resolution, no fetch.
- **Injected data block:** *(empty)*
- **Agent:** "Hi! I help analyze US airports for modernization/expansion investment. Ask me about an airport or region."
- **State after:** WS `{}` · FS `[]`

### Turn 2 — capabilities
**User:** `what can you do?`
- **classify →** `{ label: "capabilities", reason: "Asking about assistant abilities." }`
- Branch: capabilities → **data memory untouched**.
- **Injected data block:** *(empty)*
- **Agent:** "I rank US airports on congestion, unmet demand, long-haul share, and official FAA enplanement trends…"
- **State after:** WS `{}` · FS `[]`

### Turn 3 — first in_scope query (fetch)
**User:** `Compare LAX and SFO for investment potential.`
- **classify →** `{ label: "in_scope", reason: "Airport investment comparison." }`
- **Focus resolution (§4):** explicit codes → `[LAX, SFO]`. FS ← `[LAX, SFO]`.
- **Fetch vs reuse (§5):** neither in WS → call tools for both, store records.
- WS now: `{ LAX: {airport, enplanements, fetchedAtTurn:3}, SFO: {…} }`
- **Assembled prompt (§6):**
  ```
  [system prompt]
  rollingSummary:        (none yet)
  last 4 turns (text):   hey there / Hi… / what can you do? / I rank…
  focused data block:    { LAX: {...}, SFO: {...} }        ← only these 2 (≤ K)
  user:                  Compare LAX and SFO for investment potential.
  ```
- **Agent:** "LAX scores **61.3** vs SFO **50.9**. LAX runs above capacity (congestion 1.01) with a higher long-haul share (34.9%)… [table]"
- **State after:** WS `{LAX, SFO}` · FS `[LAX, SFO]` · last presented list = `[LAX, SFO]`

### Turn 4 — follow-up with anaphora (reuse, NO fetch)
**User:** `why is it higher?`
- **classify →** `in_scope` (the classifier sees recent turns, so this short message isn't `off_topic`).
- **Focus resolution:** no explicit code; anaphora "it" → `FS[0]` = **LAX**.
- **Fetch vs reuse:** LAX already in WS → **reuse** (no tool call; figures stay identical).
- **Injected data block:** `{ LAX: {...} }` only — **SFO is not needed this turn, so it is not injected.**
- **Agent:** "LAX is higher because it's operating ~16 flights/day above target capacity and carries the larger long-haul share, so expansion capital relieves a real constraint…"
- 🧠 **Memory win:** "it" resolved from the focus stack, data served from the working set → **zero re-fetch, consistent numbers, minimal context.**

### Turn 5 — modify the set (partial fetch)
**User:** `add Denver to the comparison`
- **classify →** `in_scope`.
- **Focus resolution:** explicit "Denver" → DEN; working set of interest = `{LAX, SFO, DEN}`. FS ← `[DEN, LAX, SFO]`.
- **Fetch vs reuse:** LAX, SFO **reused**; **DEN fetched** and stored.
- **Injected data block:** `{ LAX, SFO, DEN }` (3 ≤ K).
- **Agent:** "Updated ranking: **LAX 61.3 > DEN 57.4 > SFO 50.9** … [table]"
- **State after:** WS `{LAX, SFO, DEN}` · FS `[DEN, LAX, SFO]` · last presented list = `[LAX, DEN, SFO]`

### Turn 6 — off_topic (data untouched, memory preserved)
**User:** `what's the weather in Denver right now?`
- **classify →** `{ label: "off_topic", reason: "Weather, not airport investment." }`
- Branch: off_topic → **declined; data memory NOT touched; WS/FS preserved.**
- **Injected data block:** *(empty)*
- **Agent:** "I focus on airport investment analysis, not live weather. Want DEN's congestion or demand instead?"
- **State after:** WS `{LAX, SFO, DEN}` · FS `[DEN, LAX, SFO]` — **unchanged, so the next follow-up still works.**

### Turn 7 — ordinal anaphora + dimension projection
**User:** `and the second one's unmet demand?`
- **classify →** `in_scope`.
- **Focus resolution:** "the second one" → ordinal into the **last presented list** (`[LAX, DEN, SFO]`) → index 2 = **DEN**. (Ordinals resolve against the last *presented ranking*, not the raw focus stack.)
- **Dimension tag:** "unmet demand" → **field projection**: inject only DEN's unmet-demand fields.
- **Fetch vs reuse:** DEN **reused**.
- **Injected data block:** `{ DEN: { unmet_demand_pct, capacity_position } }` — **projected fields only, not the whole record.**
- **Agent:** "Denver's unmet demand is ~2.1% — it's running just under target capacity, so there's modest headroom before expansion pays off…"

### Turn 8 — long chat triggers the rolling summary
After several more `in_scope` turns the dialogue exceeds N = 4:
- The overflow turns are folded into `rollingSummary`:
  > "Compared LAX, SFO, DEN; LAX ranked highest on congestion + long-haul; discussed DEN's unmet demand."
- The assembled prompt now carries that **1-line summary** in place of the old raw turns → **the prompt stays bounded even as the conversation grows.**

### What this walkthrough demonstrates

| Mechanism | Seen in | Effect |
|---|---|---|
| Classifier gate | Turns 1, 2, 6 | 3 non-data turns ⇒ **no airport data in context** |
| Working-set reuse | Turns 4, 5, 7 | consistent numbers, **no re-fetch** |
| Focus stack | Turn 4 | resolves "it" |
| Last presented list | Turn 7 | resolves ordinals ("the second one") |
| K-cap + field projection | Turns 5, 7 | injects only the focused subset / only the asked-about fields |
| Rolling summary | Turn 8 | prompt stays small regardless of history length |

---

## 9. Streaming / events integration

No wire-contract change (consistent with #13):

- Classifier already surfaces as `tool_call(classify_message) → tool_result`.
- Data fetches surface as the normal `tool_call → tool_result` for
  `get_enplanements` and the #23 lookups.
- Memory itself is **invisible server-side state** — it shapes what context the agent
  gets, but emits no new event types.
- `AbortSignal` cancels any in-flight resolver/tool/LLM call; memory is only committed
  **after** a turn completes (don't persist a half-aborted turn).

---

## 10. Eviction, summary & full-design extras

- **Rolling summary:** when `turns` exceeds the window (N), compress the overflow into
  `rollingSummary` with one cheap LLM call ("Summarize the prior discussion in 1–2
  lines: which airports, what was concluded"). Update `summarizedUpToTurn`.
- **Focus-stack aging:** cap `focusStack` length (e.g. 8); drop codes not referenced for
  M turns from *injection eligibility* (keep them in the working set for cheap re-use if
  re-mentioned).
- **Dimension-level field projection** (§6) using an optional classifier/extractor tag.
- **Optional LLM reference-resolver** for messy anaphora (§4 step 3).
- **K-cap and N-window tuning** against the eval set.

---

## 11. Edge cases

- **Pronoun with empty focus stack** ("why is it high?" as the first message) → ask a
  clarifying question; don't fabricate a target.
- **New query that drops prior airports** ("forget those, look at Texas") → `MODIFY`-style
  intent clears/replaces focus; working set may keep old records but they won't be injected.
- **Working set grows large over a long chat** → bounded by K-cap on injection; the map
  itself is small (structured records, not text).
- **Classifier flips to `off_topic` mid-thread** → answer off-topic without touching data,
  but keep the working set intact so the next `in_scope` follow-up still works.
- **Same code fetched by two tools** → one `AirportRecord` per code holding both
  `airport` and `enplanements`.

---

## 12. Acceptance criteria

- [ ] `greeting` / `capabilities` / `off_topic` turns produce a reply **without** any
      airport record in the assembled context (assert the focused block is empty).
- [ ] An `in_scope` follow-up ("why is it higher?") after "compare LAX and SFO" resolves
      "it" to the right code **and reuses the cached record** (no second tool call).
- [ ] With > K airports in the working set, an assembled prompt injects **≤ K** records.
- [ ] Windowed dialogue + rolling summary: a long chat keeps the prompt bounded
      (assert prompt size does not grow unboundedly with turn count).
- [ ] Numbers stay consistent: a follow-up quotes the **same** figures first presented
      (served from the working set, not re-fetched/re-estimated).
- [ ] Unit tests with a **fake `LlmClient`** (no real calls): focus resolution, fetch-vs-reuse,
      K-cap, summary trigger, abort-before-commit.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass at head.

## 13. Order

Depends on **#9** and **#13**. Branch from #13's head; after #13 merges, update with
`main`. One PR. Suggested owner decisions to confirm before build: **N** (dialogue
window) and **K** (max injected records).
