import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { AgentEvent, ModelProvider } from "@airport/shared";
import type { Express } from "express";
import type { Agent } from "../agent/agent.ts";
import type { ClaudeConfig, ServerConfig } from "../config.ts";
import type { LlmClient } from "../llm/llmClient.ts";

/** A fake Gemini key: tests never call the real Gemini API. */
export const TEST_GEMINI_KEY = "test-key-not-real";

/**
 * By default no `claude` is found (empty PATH, no CLAUDE_BIN) and no Gemini key is set, so tests can never
 * reach a real LLM. Listing "gemini" sets a fake key (the Gemini model becomes available).
 */
export function testConfig(providers: ModelProvider[] = [], claude: Partial<ClaudeConfig> = {}): ServerConfig {
  return {
    port: 0,
    version: "test",
    gemini: { apiKey: providers.includes("gemini") ? TEST_GEMINI_KEY : undefined },
    claude: { bin: undefined, searchPath: "", model: undefined, ...claude },
  };
}

/** Fake LlmClients that report themselves unavailable and never stream: for tests that don't use them. */
export function offlineClients(): Record<ModelProvider, LlmClient> {
  const offline = (provider: ModelProvider): LlmClient => ({
    provider,
    health: async () => ({ status: "unavailable", detail: `${provider} is offline in this test` }),
    stream: () => {
      throw new Error(`${provider} must not be called in this test`);
    },
  });
  return { gemini: offline("gemini"), "claude-headless": offline("claude-headless") };
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
