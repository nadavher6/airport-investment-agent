import type { LlmClient } from "./llmClient.ts";

/**
 * Which model each provider uses for which job (#17): a fast one for the classifier,
 * a good one for the main answer. Server-side detail; the catalog labels do not change.
 * Claude names are `claude --model` aliases; Gemini names go into the request URL.
 */
export const MODELS = {
  "claude-headless": { classifier: "haiku", main: "opus" },
  gemini: { classifier: "gemini-flash-lite-latest", main: "gemini-3.5-flash" },
} as const satisfies Record<LlmClient["provider"], { classifier: string; main: string }>;

/**
 * The model for the main answer. CLAUDE_MODEL (`claudeOverride`) replaces the Claude main
 * model only; it never changes the classifier model or Gemini's.
 */
export function mainModel(provider: LlmClient["provider"], claudeOverride?: string): string {
  return provider === "claude-headless" && claudeOverride ? claudeOverride : MODELS[provider].main;
}
