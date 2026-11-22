import { Router } from "express";
import { API_ROUTES, nowIso, type ModelProvider, type ProviderHealthResponse } from "@airport/shared";
import { HttpError } from "../http/errors.ts";
import type { LlmClient } from "../llm/llmClient.ts";

// A Record so a new provider is a compile error here until it is listed.
const KNOWN_PROVIDERS: Record<ModelProvider, true> = { gemini: true, "claude-headless": true };
const isProvider = (value: string): value is ModelProvider => Object.hasOwn(KNOWN_PROVIDERS, value);

/** Asks the provider's LlmClient (`claude --version` for Claude, a one-model list call for Gemini). */
export function providerHealthRouter(clients: Readonly<Record<ModelProvider, LlmClient>>): Router {
  const router = Router();
  router.get(API_ROUTES.providerHealth, async (req, res) => {
    const provider = String(req.params.provider);
    if (!isProvider(provider)) throw new HttpError("not_found", `Unknown provider "${provider}"`);

    const { status, detail } = await clients[provider].health();
    const body: ProviderHealthResponse = { provider, status, detail, checkedAt: nowIso() };
    res.json(body);
  });
  return router;
}
