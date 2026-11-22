# Airport Investment Intelligence Agent ✈️

An AI-powered agent that helps identify **US airports where modernization/expansion would be most profitable**, based on flight and passenger capacity, congestion, and unmet demand.

Built as a take-home assignment for Wonderful.

## Architecture

npm-workspaces monorepo. The API contract lives in one shared package (types plus a few tiny runtime helpers) that both sides import, so a change to the wire format is a compile error on both sides.

```
packages/
  shared/            @airport/shared: API contract (types + route constants + ID helpers)
    src/ids.ts       branded IDs: MessageId, ToolCallId, ModelId
    src/models.ts    ModelInfo, ModelCapabilities
    src/chat.ts      ChatMessage, ContentBlock (text | thinking | tool_use), ChatTurn
    src/events.ts    AgentEvent: the streaming protocol (discriminated union)
    src/api.ts       API_ROUTES, request/response bodies
    src/errors.ts    ApiError, ApiErrorCode
apps/
  server/            @airport/server: Express 5 API (agent is a mock for now)
    src/agent/       Agent interface + MockAgent (swap in a real LLM agent here)
    src/catalog/     model catalog
    src/http/        SSE helpers, error middleware, request validation
    src/routes/      health, models, chat
```

## API

| Method | Path          | Request       | Response                                    |
| ------ | ------------- | ------------- | ------------------------------------------- |
| GET    | `/api/health` | –             | `HealthResponse`                            |
| GET    | `/api/models` | –             | `ModelsResponse`                            |
| POST   | `/api/chat`   | `ChatRequest` | `text/event-stream` of `AgentEvent` frames  |

Errors are always `{ "error": { "code", "message" } }` (`ApiErrorBody`) with a matching HTTP status.
Validation and model lookup happen **before** the stream opens, so they return normal 4xx/5xx responses.
Once streaming starts, failures arrive as an `error` event.

Stream event order:

```
message_start → (thinking_delta* → thinking_end)? → (tool_call → tool_result)* → text_delta* → message_end
```

Closing the connection aborts the agent run via an `AbortSignal`.

## Getting started

```bash
npm install
cp .env.example .env    # optional: add API key(s)
npm run dev:server      # API on http://localhost:8787
npm run typecheck       # all workspaces
```

## Design doc

See [`DESIGN.md`](./DESIGN.md) for scoring methodology, key tradeoffs, and where/how AI is used.
