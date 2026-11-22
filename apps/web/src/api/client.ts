import {
  API_ROUTES,
  type AgentEvent,
  type AgentEventType,
  type ApiError,
  type ApiErrorBody,
  type ApiRoute,
  type ChatRequest,
  type HealthResponse,
  type ModelProvider,
  type ModelsResponse,
  type ProviderHealthResponse,
} from "@airport/shared";
import { readSseData } from "./sse";

/** A failed request, carrying the server's typed error (or a synthesized one). */
export class ApiClientError extends Error {
  constructor(
    readonly apiError: ApiError,
    readonly status: number,
  ) {
    super(apiError.message);
    this.name = "ApiClientError";
  }
}

async function toClientError(res: Response): Promise<ApiClientError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiClientError(body.error, res.status);
  } catch {
    // Non-JSON body: usually the dev proxy reporting that the API server is down.
    const message =
      res.status === 502 || res.status === 504
        ? "Couldn't reach the API server. Is it running?"
        : `Request failed (${res.status})`;
    return new ApiClientError({ code: "internal", message }, res.status);
  }
}

// A Record (not an array) so adding an event type to the contract is a compile error here until it's listed.
const KNOWN_EVENT_TYPES: Record<AgentEventType, true> = {
  message_start: true,
  thinking_delta: true,
  thinking_end: true,
  tool_call: true,
  tool_result: true,
  text_delta: true,
  message_end: true,
  error: true,
};

const isKnownEventType = (type: unknown): type is AgentEventType =>
  typeof type === "string" && Object.hasOwn(KNOWN_EVENT_TYPES, type);

/** Parses one SSE payload. Returns null for event types this client doesn't know (e.g. from a newer server). */
function parseEvent(data: string, status: number): AgentEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new ApiClientError({ code: "internal", message: "The server sent a malformed response." }, status);
  }
  const type = typeof parsed === "object" && parsed !== null ? (parsed as { type?: unknown }).type : undefined;
  if (!isKnownEventType(type)) {
    console.warn("Ignoring unknown agent event", parsed);
    return null;
  }
  return parsed as AgentEvent;
}

async function getJson<T>(route: ApiRoute | string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(route, signal ? { signal } : {});
  if (!res.ok) throw await toClientError(res);
  return (await res.json()) as T;
}

export const api = {
  health: (signal?: AbortSignal) => getJson<HealthResponse>(API_ROUTES.health, signal),

  models: (signal?: AbortSignal) => getJson<ModelsResponse>(API_ROUTES.models, signal),

  providerHealth: (provider: ModelProvider, signal?: AbortSignal) =>
    getJson<ProviderHealthResponse>(API_ROUTES.providerHealth.replace(":provider", encodeURIComponent(provider)), signal),

  /** Streams the agent's response. Abort the signal to stop it. */
  async *streamChat(request: ChatRequest, signal: AbortSignal): AsyncGenerator<AgentEvent> {
    const res = await fetch(API_ROUTES.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(request),
      signal,
    });
    if (!res.ok || !res.body) throw await toClientError(res);

    for await (const data of readSseData(res.body)) {
      const event = parseEvent(data, res.status);
      if (event) yield event;
    }
  },
};
