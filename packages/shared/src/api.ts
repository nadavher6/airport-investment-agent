import type { ChatTurn } from "./chat.ts";
import type { IsoDateString, ModelId } from "./ids.ts";
import type { ModelInfo, ModelProvider } from "./models.ts";

/** Single source of truth for paths, so client and server can't drift apart. */
export const API_ROUTES = {
  health: "/api/health",
  models: "/api/models",
  chat: "/api/chat",
  /** Replace `:provider` with a ModelProvider. */
  providerHealth: "/api/providers/:provider/health",
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];

// GET /api/health
export interface HealthResponse {
  readonly status: "ok";
  readonly version: string;
  readonly uptimeSeconds: number;
}

// GET /api/providers/:provider/health
/** ok: usable. unavailable: not installed/configured (e.g. no `claude` binary). error: installed but failing. */
export type ProviderHealthStatus = "ok" | "unavailable" | "error";

export interface ProviderHealthResponse {
  readonly provider: ModelProvider;
  readonly status: ProviderHealthStatus;
  /** Plain-English explanation, e.g. "Claude Code 2.1.3 is installed". */
  readonly detail: string;
  readonly checkedAt: IsoDateString;
  /** The provider's version string when known (claude --version). */
  readonly version?: string;
}

// GET /api/models
export interface ModelsResponse {
  readonly models: readonly ModelInfo[];
  readonly defaultModelId: ModelId;
}

// POST /api/chat  ->  text/event-stream of AgentEvent (see events.ts)
export interface ChatRequest {
  readonly modelId: ModelId;
  /** The full conversation so far, oldest first. The last turn must be the user's. */
  readonly messages: readonly ChatTurn[];
}

/** Content type for the chat stream response. */
export const CHAT_STREAM_CONTENT_TYPE = "text/event-stream";
