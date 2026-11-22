import type { LlmMessage } from "../../llm/llmClient.ts";

/**
 * Conversation memory for the agent (tasks/05-memory.md). It separates
 * "what was said" (dialogue, carried by LlmMessage history) from "what was shown"
 * (structured tool results, cached here by airport code and injected selectively).
 */

/** A structured airport record cached across turns: the tool output, keyed by code. */
export interface AirportRecord {
  readonly airportCode: string;
  /** From get_airport_metrics (live / congestion). Shape owned by the tool. */
  readonly metrics?: unknown;
  /** From get_enplanements (FAA annual data). Shape owned by the tool. */
  readonly enplanements?: unknown;
  readonly source?: readonly string[];
  readonly fetchedAtTurn?: number;
  readonly lastReferencedTurn?: number;
}

/**
 * The state the memory layer reads to resolve references and assemble context.
 * `workingSet` is never serialized into dialogue — only into the focused block (seam A).
 */
export interface MemoryState {
  /** Structured data by airport code. */
  readonly workingSet: ReadonlyMap<string, AirportRecord>;
  /** Airport codes, most-recently referenced first (resolves "it", "that airport"). */
  readonly focusStack: readonly string[];
  /** The ordered list from the last assistant ranking (resolves ordinals, "the second one"). */
  readonly lastPresentedList: readonly string[];
  /** One- to two-line summary of turns older than the dialogue window. */
  readonly rollingSummary?: string;
}

export type { LlmMessage };
