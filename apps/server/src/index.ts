import { homedir } from "node:os";
import { LlmPassthroughAgent } from "./agent/llmPassthroughAgent.ts";
import { ClaudeHeadlessClient } from "./llm/claude/claudeHeadlessClient.ts";
import { GeminiClient } from "./llm/geminiClient.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";

// Optional repo-root .env (API keys). Missing file is fine.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const config = loadConfig();
// The selected model's provider gets every LLM call: a `claude -p` child (claude-headless) or the Gemini API.
const claude = new ClaudeHeadlessClient({ config: config.claude, home: homedir(), ...(process.env.CLAUDE_CONFIG_DIR ? { configDir: process.env.CLAUDE_CONFIG_DIR } : {}) });
const llmClients = { "claude-headless": claude, gemini: new GeminiClient({ apiKey: config.gemini.apiKey }) };
const agent = new LlmPassthroughAgent(llmClients, config.claude.model);
const app = createApp({ config, agent, llmClients });

// Express 5 also calls this callback on the server's "error" event (e.g. EADDRINUSE).
const server = app.listen(config.port, (err?: Error) => {
  if (err) {
    console.error(`Failed to listen on port ${config.port}: ${err.message}`);
    process.exit(1);
  }
  console.log(`✈  API server listening on http://localhost:${config.port}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`\n${signal} received, closing server…`);
  // Stop any running `claude` children first (SIGTERM, then SIGKILL), so none outlive the server.
  void claude.shutdown().finally(() => server.close(() => process.exit(0)));
  server.closeAllConnections();
}

// Last resort (e.g. an uncaught exception): exit handlers must be synchronous, so SIGKILL.
process.on("exit", () => claude.killAllNow());

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
