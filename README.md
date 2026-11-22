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
  server/            @airport/server: Express 5 API
    src/agent/       Agent interface + LlmPassthroughAgent (placeholder: sends the chat to the selected LLM)
    src/llm/         LlmClient interface + GeminiClient (Gemini API) and ClaudeHeadlessClient (`claude -p`)
    src/catalog/     model catalog
    src/http/        SSE helpers, error middleware, request validation
    src/routes/      health, models, chat
  web/               @airport/web: Vite + React chat UI, hand-written CSS
    src/api/         typed fetch client + SSE stream reader
    src/state/       chatReducer: applies AgentEvents to messages (pure, exhaustive)
    src/hooks/       useChat, useModels, useHealth, useTheme, useStickToBottom
    src/components/  TopBar, Composer, ModelPicker, MessageView, blocks/ (text, thinking, tool use)
    src/styles/      design tokens (light/dark) + base
```

In dev the browser only talks to Vite (`:5173`), which proxies `/api/*` to the server (`:8787`), so no CORS setup is needed.

## API

| Method | Path          | Request       | Response                                    |
| ------ | ------------- | ------------- | ------------------------------------------- |
| GET    | `/api/health` | –             | `HealthResponse`                            |
| GET    | `/api/models` | –             | `ModelsResponse`                            |
| POST   | `/api/chat`   | `ChatRequest` | `text/event-stream` of `AgentEvent` frames  |
| GET    | `/api/providers/:provider/health` | – | `ProviderHealthResponse` |

`/api/providers/:provider/health` checks one `ModelProvider`. For `claude-headless` it runs `claude --version`
(5 s timeout) and answers `ok`, `unavailable` (no `claude` binary on PATH or at `CLAUDE_BIN`) or `error`, with a
plain-English `detail`. For `gemini` it lists one model with `GEMINI_API_KEY` (5 s timeout): `ok`, `unavailable` (no
key in `.env`) or `error` (for example "Gemini: invalid API key"). The key is never returned or logged.

There are two providers: **Gemini** (`gemini-3.5-flash`, the default, available when `GEMINI_API_KEY` is set) and
**Claude headless** (available when the `claude` binary is found).

Errors are always `{ "error": { "code", "message" } }` (`ApiErrorBody`) with a matching HTTP status.
Validation and model lookup happen **before** the stream opens, so they return normal 4xx/5xx responses.
Once streaming starts, failures arrive as an `error` event.

Stream event order:

```
message_start → (tool_call(classify_message) → tool_result)? → (thinking_delta* → thinking_end)? → (tool_call → tool_result)* → text_delta* → message_end
```

The optional first `classify_message` pair (LLM-backed models only) is the one pair allowed before thinking.

For an LLM-backed model, the first step of every turn is a message classifier: it labels the latest user
message `greeting`, `capabilities`, `off_topic` or `in_scope` (the fallback) and is shown as a
`classify_message` `tool_call`/`tool_result` pair with the output `{ label, reason }`, right after
`message_start` and before any thinking. The label does not change what happens next yet.

Closing the connection aborts the agent run via an `AbortSignal` (it cancels the classifier call too).

## Getting started

```bash
npm install
cp .env.example .env    # then set GEMINI_API_KEY (from Google AI Studio) for the Gemini model
```

### Run with F5 (VS Code)

Open **Run and Debug**, pick **Full stack**, and press **F5**. It starts:

- **Server** in its own terminal, with the debugger attached (breakpoints in `apps/server` work)
- **Web** in its own terminal; the browser opens once Vite is ready

Stopping either one stops both.

### Run from the terminal

```bash
npm run dev:server      # API on http://localhost:8787
npm run dev:web         # UI  on http://localhost:5173
npm run typecheck       # all workspaces
npm run build           # production build of the web app
```

## Data

Passenger volumes come from the FAA's official **Commercial Service Enplanements** files, CY2015–CY2024.

```bash
npm run data:download   # fetch the 10 workbooks into data/raw/ (gitignored)
npm run data:build-enplanements   # rebuild the committed data/enplanements.json from them
```

The script needs `bash` and `curl` (macOS or Linux; on Windows, use WSL or Git Bash). It checks each file's
SHA-256, keeps files that already match, and exits non-zero if any year fails. `-- --force` downloads everything again.

Where each file came from, its checksum, format notes, and how `data/enplanements.json` is built (parsing rules,
FAA revisions, trend formulas) are in [`data/raw/SOURCES.md`](./data/raw/SOURCES.md).

## Tests

[Vitest](https://vitest.dev) in both apps. Test files sit next to the code they cover (`*.test.ts(x)`).

```bash
npm test                          # everything
npm run test:watch -w @airport/web   # watch mode for one app
```

| App | What's covered |
| --- | --- |
| server | request validation rules, config parsing, model catalog, the LLM clients against a shared contract (fake `claude` binary, fake fetch for Gemini), LlmPassthroughAgent event order and abort, `.env` stays gitignored, every route through `supertest` (SSE framing, 400/404/503 errors, mid-stream agent failure, agent aborted on client disconnect) |
| web | `chatReducer` for every event and edge case, SSE reader (split frames, CRLF, split UTF-8), API client errors, `useChat` (history, stop, double-send, failures), Composer keys/IME, thinking and tool blocks, model picker keyboard and a11y, and a full App turn against a fake API |

## Design doc

See [`DESIGN.md`](./DESIGN.md) for scoring methodology, key tradeoffs, and where/how AI is used.
