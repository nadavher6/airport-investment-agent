# Airport Investment Intelligence Agent ✈️

An AI-powered agent that helps identify **US airports where modernization/expansion would be most profitable**, based on flight and passenger capacity, congestion, and unmet demand.

Built as a take-home assignment for Wonderful.

## What it does

Answer analyst questions like:

- Which airports in New England are strong candidates for terminal expansion?
- Compare LA and Santa Ana airport congestion levels.
- What is the percentage of long-haul flights out of Anchorage airport?
- What is the unmet flight demand in SFO airport and why?

The agent:
- Pulls airport/aviation data from **public APIs**
- Ranks/compares airports using **deterministic scoring logic** (not just LLM output)
- **Explains its reasoning** and states assumptions/uncertainty
- Supports **conversational follow-up** questions via a chat interface

## Tech stack

- **TypeScript** + Node.js (ES modules)
- `tsx` for fast dev/run
- AI provider: pluggable (Gemini / Groq / OpenRouter — all free tier)

## Getting started

```bash
npm install
cp .env.example .env   # add your API key(s)
npm run dev            # run with hot reload
```

Other scripts:

```bash
npm start       # run once
npm run build   # compile to dist/
npm run typecheck
```

## Project structure (planned)

```
src/
  index.ts        # entry point
  data/           # fetch + normalize airport/flight data from public APIs
  scoring/        # deterministic ranking logic (KPIs, congestion score)
  agent/          # AI layer: reasoning, explanation, tool use
  chat/           # chat interface (CLI first; voice is a bonus)
```

## Design doc

See [`DESIGN.md`](./DESIGN.md) for scoring methodology, key tradeoffs, and where/how AI is used.
