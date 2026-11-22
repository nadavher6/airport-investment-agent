import { MockAgent } from "./agent/mockAgent.ts";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";

// Optional repo-root .env (API keys). Missing file is fine.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const config = loadConfig();
const app = createApp({ config, agent: new MockAgent() });

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
  server.close(() => process.exit(0));
  server.closeAllConnections();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
