import type { ModelProvider } from "@airport/shared";
import packageJson from "../package.json" with { type: "json" };

export interface ServerConfig {
  readonly port: number;
  readonly version: string;
  /** Which providers have an API key set. Drives ModelInfo.available. */
  readonly configuredProviders: ReadonlySet<ModelProvider>;
}

const PROVIDER_KEY_ENV: Record<ModelProvider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

function parsePort(raw: string | undefined, fallback: number): number {
  const port = Number(raw ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const providers = Object.entries(PROVIDER_KEY_ENV) as [ModelProvider, string][];
  return {
    port: parsePort(env.PORT, 8787),
    // From package.json, not npm_package_version, which is unset when started without npm.
    version: packageJson.version,
    configuredProviders: new Set(
      providers.filter(([, envVar]) => Boolean(env[envVar]?.trim())).map(([provider]) => provider),
    ),
  };
}
