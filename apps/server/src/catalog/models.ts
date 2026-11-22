import { asModelId, type ModelId, type ModelInfo, type ModelProvider } from "@airport/shared";
import { findClaudeBinary } from "../llm/claude/binary.ts";
import type { ServerConfig } from "../config.ts";

type ModelDefinition = Omit<ModelInfo, "available">;

const MODEL_DEFINITIONS: readonly ModelDefinition[] = [
  {
    id: asModelId("gemini-3.8-flash"),
    label: "Gemini 3.8 Flash",
    provider: "gemini",
    description: "Fast, free-tier default with reasoning and tool calls.",
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
 * The model list the UI shows. Gemini is available when GEMINI_API_KEY is set; claude-headless when the
 * `claude` binary is found. The key itself never appears here.
 */
export function listModels(config: ServerConfig): ModelInfo[] {
  const available: Record<ModelProvider, boolean> = {
    gemini: config.gemini.apiKey !== undefined,
    "claude-headless": findClaudeBinary(config.claude) !== undefined,
  };
  return MODEL_DEFINITIONS.map((model) => ({ ...model, available: available[model.provider] }));
}

export function findModel(config: ServerConfig, id: ModelId): ModelInfo | undefined {
  return listModels(config).find((model) => model.id === id);
}
