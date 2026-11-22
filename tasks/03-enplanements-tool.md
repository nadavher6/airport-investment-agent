# Task 3 — Expose `get_enplanements` as an Agent Tool

**Objective:** Load `data/enplanements.json` at runtime and expose a typed
`get_enplanements(airportCode)` lookup, then register it as a tool the agent can call.

## 3a. Runtime lookup (`src/data/enplanements/lookup.ts`)

```ts
import enplanements from "../../../data/enplanements.json" assert { type: "json" };

export interface EnplanementResult {
  airportCode: string;
  name: string;
  city: string;
  state: string;
  hubType: "L" | "M" | "S" | "N";
  latest: {
    year: number;
    enplanements: number;
    priorYear: number;
    yoyChangePct: number;
    rank: number;
  };
  trend: {
    cagr5yr: number | null;
    cagr10yr: number | null;
    recoveryVs2019: number | null;
  };
  series: Array<{ year: number; enplanements: number; rank: number }>;
  source: string;
}

export function getEnplanements(code: string): EnplanementResult | null {
  const key = code.trim().toUpperCase();
  const rec = (enplanements.airports as Record<string, any>)[key];
  if (!rec) return null;                      // unknown code -> null, never fabricate
  return { ...rec, source: enplanements.meta.source };
}
```

- O(1) in-memory lookup, < 5 ms, no network.
- **Returns `null` for unknown codes** — the agent must treat that as "no data," not
  invent figures (mirrors the existing invalid-airport guard).

## 3b. Tool definition (`src/agent/tools/getEnplanements.ts`)

Expose it in whatever tool shape the agent layer uses (the repo's agent is pluggable —
Gemini / Groq / OpenRouter — so follow the existing tool-registration pattern in
`apps/server/src/agent/`). The tool contract:

```ts
export const getEnplanementsTool = {
  name: "get_enplanements",
  description:
    "Official FAA passenger boarding (enplanement) data for a US airport: latest-year " +
    "total, hub classification (Large/Medium/Small/Nonhub), national rank, year-over-year " +
    "change, 5- and 10-year CAGR, and COVID recovery ratio. Covers CY2015-CY2024.",
  parameters: {
    type: "object",
    properties: {
      airport_code: {
        type: "string",
        description: "3-letter IATA/FAA code, e.g. 'LAX', 'ATL', 'ORD'.",
      },
    },
    required: ["airport_code"],
  },
  run: ({ airport_code }: { airport_code: string }) => {
    const result = getEnplanements(airport_code);
    if (!result) {
      return { airport_code: airport_code.toUpperCase(), error: "no_enplanement_data" };
    }
    return result;
  },
};
```

Register it alongside the existing airport-metrics tool so the agent can call **both**
(e.g. `get_airport_metrics` for live congestion + `get_enplanements` for official volume/trend).

## 3c. Wire into scoring (optional but recommended)

Feed the real figures into the deterministic scorer (`src/scoring/`, per `DESIGN.md`):

- Replace any mocked throughput input with `latest.enplanements`.
- Use `trend.cagr5yr` as a **growth** KPI (a durable-demand signal — see criterion #1
  and #4 in `../02-traffic-and-demand.md`).
- Use `hubType` to normalize/segment comparisons (compare Large hubs to Large hubs).

## Acceptance criteria

- [ ] `getEnplanements("LAX")` returns real totals + hub + CAGR; `getEnplanements("ZZZ")` returns `null`
- [ ] Tool is registered and callable by the agent; appears in the tool list
- [ ] A chat like "How has LAX passenger traffic trended over 10 years?" yields a
      brief citing **real FAA numbers** and the CAGR
- [ ] Scoring consumes `enplanements` / `cagr5yr` instead of mocked values (if 3c done)
- [ ] `types-only` contract in `@airport/shared` updated if the tool result crosses the wire

## Notes

- Keep the JSON import as a build-time asset so it ships with the server bundle.
- If the agent runs client-side-only in some mode, expose the lookup behind an API
  route (`GET /api/enplanements/:code`) instead of importing JSON in the browser.
