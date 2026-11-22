import type { AgentEvent, ModelProvider } from "@airport/shared";
import type { Agent } from "../agent/agent.ts";
import type { ServerConfig } from "../config.ts";

export function testConfig(providers: ModelProvider[] = []): ServerConfig {
  return { port: 0, version: "test", configuredProviders: new Set(providers) };
}

/** An agent that replays a fixed script of events (optionally failing afterwards). */
export function scriptedAgent(events: AgentEvent[], failAfter = false): Agent {
  return {
    async *run() {
      yield* events;
      if (failAfter) throw new Error("boom");
    },
  };
}

/** Parses an SSE response body back into the events the server wrote. */
export function parseSse(body: string): AgentEvent[] {
  return body
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice("data: ".length)) as AgentEvent);
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}
