import { Router } from "express";
import { API_ROUTES, nowIso, type ModelProvider, type ProviderHealthResponse } from "@airport/shared";
import { checkClaudeHealth, type ClaudeHealthOptions } from "../agent/claude/health.ts";
import type { ServerConfig } from "../config.ts";
import { HttpError } from "../http/errors.ts";

// A Record so a new provider is a compile error here until it has a health check.
const KNOWN_PROVIDERS: Record<ModelProvider, true> = { gemini: true, groq: true, openrouter: true, "claude-headless": true };
const isProvider = (value: string): value is ModelProvider => Object.hasOwn(KNOWN_PROVIDERS, value);

export type ProviderHealthTimeouts = Pick<ClaudeHealthOptions, "versionTimeoutMs" | "deepTimeoutMs">;

export function providerHealthRouter(config: ServerConfig, timeouts: ProviderHealthTimeouts = {}): Router {
  const router = Router();
  router.get(API_ROUTES.providerHealth, async (req, res) => {
    const provider = String(req.params.provider);
    if (!isProvider(provider)) throw new HttpError("not_found", `Unknown provider "${provider}"`);

    let body: ProviderHealthResponse;
    if (provider === "claude-headless") {
      body = await checkClaudeHealth(config.claude, { ...timeouts, deep: req.query.deep === "1" });
    } else {
      // API-key providers are still served by the mock agent: there is nothing live to check yet.
      const hasKey = config.configuredProviders.has(provider) || config.configuredProviders.size === 0;
      body = hasKey
        ? { provider, status: "ok", detail: "Served by the mock agent; no live check.", checkedAt: nowIso() }
        : { provider, status: "unavailable", detail: "No API key configured for this provider.", checkedAt: nowIso() };
    }
    res.json(body);
  });
  return router;
}
