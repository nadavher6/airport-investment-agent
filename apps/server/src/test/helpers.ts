import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { AgentEvent, ModelProvider } from "@airport/shared";
import type { Express } from "express";
import type { Agent } from "../agent/agent.ts";
import type { ClaudeConfig, ServerConfig } from "../config.ts";

/** By default no `claude` is found (empty PATH, no CLAUDE_BIN), so tests can never reach the real one. */
export function testConfig(providers: ModelProvider[] = [], claude: Partial<ClaudeConfig> = {}): ServerConfig {
  return {
    port: 0,
    version: "test",
    configuredProviders: new Set(providers),
    claude: { bin: undefined, searchPath: "", model: undefined, maxConcurrent: 2, ...claude },
  };
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

/** Listens on a free loopback port. `close()` drops open sockets and resolves once the server has stopped. */
export async function startServer(app: Express): Promise<{ url: string; close: () => Promise<void> }> {
  const server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
        server.closeAllConnections();
      }),
  };
}

/** Opens a chat stream, waits for the first frame, then disconnects like a closed tab. */
export async function disconnectAfterFirstFrame(url: string, body: unknown): Promise<void> {
  const client = new AbortController();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: client.signal,
  });
  await res.body!.getReader().read();
  client.abort();
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterable) items.push(item);
  return items;
}
