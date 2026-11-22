import express, { type Express } from "express";
import type { Agent } from "./agent/agent.ts";
import type { ServerConfig } from "./config.ts";
import { errorHandler, notFoundHandler } from "./http/errors.ts";
import { chatRouter } from "./routes/chat.ts";
import { healthRouter } from "./routes/health.ts";
import { modelsRouter } from "./routes/models.ts";

export interface AppDependencies {
  readonly config: ServerConfig;
  readonly agent: Agent;
}

/** Builds the app without listening, so it can be mounted in tests. */
export function createApp({ config, agent }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.use(healthRouter(config));
  app.use(modelsRouter(config));
  app.use(chatRouter(config, agent));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
