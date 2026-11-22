import type { LlmMessage } from "../../llm/llmClient.ts";
import type { AirportRecord } from "./types.ts";

/**
 * Context assembly — the relevance filter (tasks/05-memory.md §6).
 * Memory enters through two seams:
 *   A) the system message: rolling summary + the focused data block (retrieved context);
 *   B) the windowed dialogue turns: the last N messages, text only, no JSON.
 * The result plugs straight into LlmRequest ({ system, messages }).
 */

/** N dialogue pairs -> this many messages kept in the window. */
export const DEFAULT_WINDOW_TURNS = 8; // N = 4 user+assistant pairs
/** K: the most airport records injected in one turn, however large the working set. */
export const DEFAULT_MAX_RECORDS = 4;

/**
 * Pick the records to inject: in `codes` order, skipping ones with no data, capped at K.
 * `project` optionally trims a record to the dimension the turn is about.
 * `pinned` (the codes the user named this turn) are never dropped by the cap: they come first
 * and the cap trims the other, older focus codes instead.
 */
export function selectFocusedRecords(
  workingSet: ReadonlyMap<string, AirportRecord>,
  codes: readonly string[],
  maxRecords = DEFAULT_MAX_RECORDS,
  project?: (record: AirportRecord) => AirportRecord,
  pinned: readonly string[] = [],
): AirportRecord[] {
  const out: AirportRecord[] = [];
  const seen = new Set<string>();
  const take = (code: string): void => {
    const rec = workingSet.get(code);
    if (rec && !seen.has(code)) {
      seen.add(code);
      out.push(project ? project(rec) : rec);
    }
  };
  for (const code of pinned) take(code);
  for (const code of codes) {
    if (out.length >= maxRecords) break;
    take(code);
  }
  return out;
}

export interface MemoryBlockParts {
  readonly rollingSummary?: string;
  readonly focusedRecords?: readonly AirportRecord[];
}

/**
 * Seam A: append the memory block to the system prompt. Returns the prompt unchanged
 * when there is nothing to inject (greeting / capabilities / off_topic turns), so those
 * turns carry no airport data.
 */
export function buildMemorySystemBlock(systemPrompt: string, parts: MemoryBlockParts): string {
  const sections: string[] = [];
  if (parts.rollingSummary && parts.rollingSummary.trim()) {
    sections.push(`## Conversation memory\nSummary of earlier discussion:\n${parts.rollingSummary.trim()}`);
  }
  if (parts.focusedRecords && parts.focusedRecords.length > 0) {
    const byId: Record<string, AirportRecord> = {};
    for (const r of parts.focusedRecords) byId[r.airportCode] = r;
    sections.push(`## Airport data in focus (earlier tool results in this conversation: use them instead of calling the same tool again; do not fabricate)\n${JSON.stringify(byId)}`);
  }
  return sections.length > 0 ? `${systemPrompt}\n\n${sections.join("\n\n")}` : systemPrompt;
}

export interface AssembleParams {
  readonly systemPrompt: string;
  /** Full history, oldest first, including the latest user message. */
  readonly history: readonly LlmMessage[];
  readonly focusedRecords?: readonly AirportRecord[];
  readonly rollingSummary?: string;
  /** How many trailing messages to keep (defaults to DEFAULT_WINDOW_TURNS). */
  readonly windowTurns?: number;
}

export interface AssembledRequest {
  readonly system: string;
  readonly messages: LlmMessage[];
}

/** Build the final { system, messages } for LlmClient.stream. */
export function assembleRequest(params: AssembleParams): AssembledRequest {
  const window = params.windowTurns ?? DEFAULT_WINDOW_TURNS;
  const system = buildMemorySystemBlock(params.systemPrompt, {
    ...(params.rollingSummary !== undefined ? { rollingSummary: params.rollingSummary } : {}),
    ...(params.focusedRecords !== undefined ? { focusedRecords: params.focusedRecords } : {}),
  });
  const windowed = params.history.slice(-window);
  // Providers (Gemini, Anthropic) need the first turn to be the user's: drop leading non-user messages.
  const firstUser = windowed.findIndex((m) => m.role === "user");
  const kept = firstUser === -1 ? windowed : windowed.slice(firstUser);
  const messages = kept.map((m) => ({ role: m.role, content: m.content }));
  return { system, messages };
}
