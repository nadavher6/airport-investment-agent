import { Router } from "express";
import { API_ROUTES, nowIso, type ModelProvider, type ProviderHealthResponse } from "@airport/shared";
import type { ServerConfig } from "../config.ts";
import { HttpError } from "../http/errors.ts";
import type { LlmClient } from "../llm/llmClient.ts";

// A Record so a new provider is a compile error here until it is listed.
const KNOWN_PROVIDERS: Record<ModelProvider, true> = { gemini: true, groq: true, openrouter: true, "claude-headless": true };
const isProvider = (value: string): value is ModelProvider => Object.hasOwn(KNOWN_PROVIDERS, value);

/** Asks the provider's LlmClient. Providers without one are still served by the mock agent. */
export function providerHealthRouter(config: ServerConfig, clients: Partial<Record<ModelProvider, LlmClient>>): Router {
  const router = Router();
  router.get(API_ROUTES.providerHealth, async (req, res) => {
    const provider = String(req.params.provider);
    if (!isProvider(provider)) throw new HttpError("not_found", `Unknown provider "${provider}"`);

    const client = clients[provider];
    const hasKey = config.configuredProviders.has(provider) || config.configuredProviders.size === 0;
    const { status, detail } = client
      ? await client.health()
      : hasKey
        ? { status: "ok" as const, detail: "Served by the mock agent; no live check." }
        : { status: "unavailable" as const, detail: "No API key configured for this provider." };
    const body: ProviderHealthResponse = { provider, status, detail, checkedAt: nowIso() };
    res.json(body);
  });
  return router;
}
