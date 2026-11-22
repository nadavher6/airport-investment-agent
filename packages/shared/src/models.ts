import type { ModelId } from "./ids.ts";

/**
 * "gemini" calls the Gemini API with GEMINI_API_KEY from .env. "claude-headless" runs a local `claude -p`
 * child process per chat turn (the owner's own Claude login).
 */
export type ModelProvider = "gemini" | "claude-headless";

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
  /** False when GEMINI_API_KEY is not set (gemini) or no `claude` binary is found (claude-headless). */
  readonly available: boolean;
}
