import type { ModelProvider } from "@airport/shared";
import packageJson from "../package.json" with { type: "json" };

/** Settings for the claude-headless provider (a local `claude -p` child process per chat turn). */
export interface ClaudeConfig {
  /** CLAUDE_BIN: explicit path to the binary. Undefined means "look up `claude` on searchPath". */
  readonly bin: string | undefined;
  /** The PATH to search when `bin` is unset. */
  readonly searchPath: string;
  /** CLAUDE_MODEL: passed as `--model` when set (e.g. "sonnet"). */
  readonly model: string | undefined;
}

export interface ServerConfig {
  readonly port: number;
  readonly version: string;
  /** Which API-key providers have a key set. Drives ModelInfo.available for them. */
  readonly configuredProviders: ReadonlySet<ModelProvider>;
  readonly claude: ClaudeConfig;
}

/** Providers that need an API key. claude-headless uses the local `claude` login instead. */
type KeyedProvider = Exclude<ModelProvider, "claude-headless">;

const PROVIDER_KEY_ENV: Record<KeyedProvider, string> = {
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

const optional = (raw: string | undefined): string | undefined => (raw?.trim() ? raw.trim() : undefined);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const providers = Object.entries(PROVIDER_KEY_ENV) as [KeyedProvider, string][];
  return {
    port: parsePort(env.PORT, 8787),
    // From package.json, not npm_package_version, which is unset when started without npm.
    version: packageJson.version,
    configuredProviders: new Set(
      providers.filter(([, envVar]) => Boolean(env[envVar]?.trim())).map(([provider]) => provider),
    ),
    claude: {
      bin: optional(env.CLAUDE_BIN),
      searchPath: env.PATH ?? "",
      model: optional(env.CLAUDE_MODEL),
    },
  };
}
