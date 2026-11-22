import type { ModelId } from "./ids.ts";

export type ModelProvider = "gemini" | "groq" | "openrouter";

/** What a model can do. The UI uses this to show capability chips in the picker. */
export interface ModelCapabilities {
  readonly thinking: boolean;
  readonly toolUse: boolean;
}

export interface ModelInfo {
  readonly id: ModelId;
  readonly label: string;
  readonly provider: ModelProvider;
  readonly description: string;
  readonly capabilities: ModelCapabilities;
  /** False when the server has no API key configured for this provider. */
  readonly available: boolean;
}
