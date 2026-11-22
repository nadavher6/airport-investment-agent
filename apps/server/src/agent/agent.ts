import type { AgentEvent, ChatRequest, ModelInfo } from "@airport/shared";

export interface AgentRunInput {
  readonly request: ChatRequest;
  readonly model: ModelInfo;
  /** Aborted when the client disconnects or presses Stop. */
  readonly signal: AbortSignal;
}

/**
 * The seam between HTTP and intelligence. The route only knows how to pipe
 * AgentEvents to the client; a real LLM agent replaces the mock by implementing this.
 */
export interface Agent {
  run(input: AgentRunInput): AsyncIterable<AgentEvent>;
}
