import packageJson from "../package.json" with { type: "json" };

/** Settings for the claude-headless provider (a local `claude -p` child process per chat turn). */
export interface ClaudeConfig {
  /** CLAUDE_BIN: explicit path to the binary. Undefined means "look up `claude` on searchPath". */
  readonly bin: string | undefined;
  /** The PATH to search when `bin` is unset. */
  readonly searchPath: string;
  /** CLAUDE_MODEL: overrides the Claude MAIN model only (e.g. "sonnet"); the classifier keeps its own (#17). */
  readonly model: string | undefined;
}

/** Settings for the gemini provider (the Gemini API). */
export interface GeminiConfig {
  /** GEMINI_API_KEY from .env, trimmed. Undefined when unset or blank. Never log or return it. */
  readonly apiKey: string | undefined;
}

export interface ServerConfig {
  readonly port: number;
  readonly version: string;
  readonly gemini: GeminiConfig;
  readonly claude: ClaudeConfig;
}

function parsePort(raw: string | undefined, fallback: number): number {
  const port = Number(raw ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw}`);
  }
  return port;
}

const optional = (raw: string | undefined): string | undefined => (raw?.trim() ? raw.trim() : undefined);

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: parsePort(env.PORT, 8787),
    // From package.json, not npm_package_version, which is unset when started without npm.
    version: packageJson.version,
    gemini: { apiKey: optional(env.GEMINI_API_KEY) },
    claude: {
      bin: optional(env.CLAUDE_BIN),
      searchPath: env.PATH ?? "",
      model: optional(env.CLAUDE_MODEL),
    },
  };
}
