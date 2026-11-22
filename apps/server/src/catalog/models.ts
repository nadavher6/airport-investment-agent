import { asModelId, type ModelId, type ModelInfo } from "@airport/shared";
import { findClaudeBinary } from "../agent/claude/binary.ts";
import type { ServerConfig } from "../config.ts";

type ModelDefinition = Omit<ModelInfo, "available">;

const MODEL_DEFINITIONS: readonly ModelDefinition[] = [
  {
    id: asModelId("gemini-2.5-flash"),
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "Fast, free-tier default with reasoning and tool calls.",
    capabilities: { thinking: true, toolUse: true },
  },
  {
    id: asModelId("llama-3.3-70b-versatile"),
    label: "Llama 3.3 70B",
    provider: "groq",
    description: "Very low latency on Groq. Tool calls, no visible thinking.",
    capabilities: { thinking: false, toolUse: true },
  },
  {
    id: asModelId("openai/gpt-oss-120b:free"),
    label: "GPT-OSS 120B",
    provider: "openrouter",
    description: "Open-weight reasoning model via OpenRouter's free pool.",
    capabilities: { thinking: true, toolUse: true },
  },
  {
    id: asModelId("claude-headless"),
    label: "Claude (headless session)",
    provider: "claude-headless",
    description: "Your local Claude Code login, run headless with its built-in tools turned off.",
    capabilities: { thinking: true, toolUse: true },
  },
];

export const DEFAULT_MODEL_ID: ModelId = MODEL_DEFINITIONS[0]!.id;

/**
 * The model list the UI shows. claude-headless is available when the `claude` binary is found.
 * The API-key models are still served by the mock agent, so with no keys set they are all marked
 * available and the mock can be exercised from any of them.
 */
export function listModels(config: ServerConfig): ModelInfo[] {
  const anyConfigured = config.configuredProviders.size > 0;
  const claudeFound = findClaudeBinary(config.claude) !== undefined;
  return MODEL_DEFINITIONS.map((model) => ({
    ...model,
    available:
      model.provider === "claude-headless"
        ? claudeFound
        : anyConfigured
          ? config.configuredProviders.has(model.provider)
          : true,
  }));
}

export function findModel(config: ServerConfig, id: ModelId): ModelInfo | undefined {
  return listModels(config).find((model) => model.id === id);
}
