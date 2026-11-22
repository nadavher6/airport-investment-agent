import {
  API_ROUTES,
  type AgentEvent,
  type ApiError,
  type ApiErrorBody,
  type ApiRoute,
  type ChatRequest,
  type HealthResponse,
  type ModelsResponse,
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

async function getJson<T>(route: ApiRoute, signal?: AbortSignal): Promise<T> {
  const res = await fetch(route, signal ? { signal } : {});
  if (!res.ok) throw await toClientError(res);
  return (await res.json()) as T;
}

export const api = {
  health: (signal?: AbortSignal) => getJson<HealthResponse>(API_ROUTES.health, signal),

  models: (signal?: AbortSignal) => getJson<ModelsResponse>(API_ROUTES.models, signal),

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
      yield JSON.parse(data) as AgentEvent;
    }
  },
};
