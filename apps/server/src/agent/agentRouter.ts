import type { AgentEvent, ModelProvider } from "@airport/shared";
import type { Agent, AgentRunInput } from "./agent.ts";

/**
 * Picks the agent for a request by the selected model's provider. Providers without their
 * own agent fall back (today: MockAgent), so selecting claude-headless sends every LLM call there.
 */
export class AgentRouter implements Agent {
  constructor(
    private readonly byProvider: Partial<Record<ModelProvider, Agent>>,
    private readonly fallback: Agent,
  ) {}

  agentFor(provider: ModelProvider): Agent {
    return this.byProvider[provider] ?? this.fallback;
  }

  run(input: AgentRunInput): AsyncIterable<AgentEvent> {
    return this.agentFor(input.model.provider).run(input);
  }
}
