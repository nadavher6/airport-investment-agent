import type { ModelId } from "./ids.ts";

/** "claude-headless" runs a local `claude -p` child process per chat turn (the owner's own Claude login). */
export type ModelProvider = "gemini" | "groq" | "openrouter" | "claude-headless";

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
  /** False when the server has no API key for this provider (or, for claude-headless, no `claude` binary). */
  readonly available: boolean;
}
