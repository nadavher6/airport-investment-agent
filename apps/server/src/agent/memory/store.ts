import type { AirportRecord } from "./types.ts";

/**
 * In-memory working-set store, keyed by conversation id (tasks/05-memory.md §3).
 * Holds the structured tool results across turns so follow-ups reuse them (consistent
 * numbers, no re-fetch) instead of re-serializing data into the dialogue.
 *
 * NOTE: wiring depends on a stable conversation id reaching the agent. ChatRequest has no
 * such id yet, so this is used once that lands (or an id is derived per connection). Until
 * then it is exercised by unit tests and ready to plug in.
 */
export class WorkingSetStore {
  private readonly byConversation = new Map<string, Map<string, AirportRecord>>();

  /** The working set for a conversation (empty map if unknown). Read-only view. */
  get(conversationId: string): ReadonlyMap<string, AirportRecord> {
    return this.byConversation.get(conversationId) ?? new Map();
  }

  /** Insert or merge a record by airport code (new fields win, old ones are kept). */
  upsert(conversationId: string, record: AirportRecord): void {
    let set = this.byConversation.get(conversationId);
    if (!set) {
      set = new Map();
      this.byConversation.set(conversationId, set);
    }
    const prev = set.get(record.airportCode);
    set.set(record.airportCode, prev ? { ...prev, ...record } : record);
  }

  /** Drop all data for a conversation (e.g. "clear context"). */
  clear(conversationId: string): void {
    this.byConversation.delete(conversationId);
  }
}
