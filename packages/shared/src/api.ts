import type { ChatTurn } from "./chat.ts";
import type { ModelId } from "./ids.ts";
import type { ModelInfo } from "./models.ts";

/** Single source of truth for paths, so client and server can't drift apart. */
export const API_ROUTES = {
  health: "/api/health",
  models: "/api/models",
  chat: "/api/chat",
} as const;

export type ApiRoute = (typeof API_ROUTES)[keyof typeof API_ROUTES];

// GET /api/health
export interface HealthResponse {
  readonly status: "ok";
  readonly version: string;
  readonly uptimeSeconds: number;
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
