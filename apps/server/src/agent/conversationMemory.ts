import type { ConversationId, JsonValue } from "@airport/shared";
import type { AirportRecord, MemoryState } from "./memory/types.ts";

/**
 * Per-conversation memory (#25, wired in #48): the structured tool results by airport code and the focus stack,
 * kept across turns so follow-ups ("and Boston?", "why is it higher?") reuse data (tasks/05-memory.md).
 *
 * It is keyed ONLY by the client's `conversationId` (ChatRequest), never by message content, so two chats never
 * share state. It is bounded: at most `maxConversations` chats (the least recently used is evicted), each idle
 * for at most `ttlMs` (then it is dropped), each with at most `maxRecords` airport records. A turn with no
 * conversationId has no memory: the agent does not call this class at all.
 */
interface ConversationState {
  readonly workingSet: Map<string, AirportRecord>;
  focusStack: string[];
  lastPresentedList: string[];
  turn: number;
  touchedAt: number;
}

export interface ConversationMemoryOptions {
  /** Most conversations kept; the least recently used one is evicted past this. Default 500. */
  readonly maxConversations?: number;
  /** A conversation idle for longer than this is dropped. Default 30 minutes. */
  readonly ttlMs?: number;
  /** Most airport records per conversation; the least recently stored is dropped past this. Default 50. */
  readonly maxRecords?: number;
  /** The clock, injectable for tests. Default Date.now. */
  readonly now?: () => number;
}

export const DEFAULT_MAX_CONVERSATIONS = 500;
export const DEFAULT_MEMORY_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_MAX_RECORDS_PER_CONVERSATION = 50;
const MAX_FOCUS_STACK = 8;

export class ConversationMemory {
  // A Map keeps insertion order: re-inserting on every access makes the first key the least recently used.
  private readonly byId = new Map<ConversationId, ConversationState>();
  private readonly maxConversations: number;
  private readonly ttlMs: number;
  private readonly maxRecords: number;
  private readonly now: () => number;

  constructor(options: ConversationMemoryOptions = {}) {
    this.maxConversations = options.maxConversations ?? DEFAULT_MAX_CONVERSATIONS;
    this.ttlMs = options.ttlMs ?? DEFAULT_MEMORY_TTL_MS;
    this.maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS_PER_CONVERSATION;
    this.now = options.now ?? Date.now;
  }

  /** How many conversations are held (for tests and bounds checks). */
  get size(): number {
    return this.byId.size;
  }

  private ensure(id: ConversationId): ConversationState {
    const now = this.now();
    let s = this.byId.get(id);
    if (s !== undefined && now - s.touchedAt > this.ttlMs) s = undefined;
    this.byId.delete(id);
    s ??= { workingSet: new Map(), focusStack: [], lastPresentedList: [], turn: 0, touchedAt: now };
    s.touchedAt = now;
    this.byId.set(id, s);
    this.evict(now);
    return s;
  }

  /** Drops expired conversations, then the least recently used ones past the size cap. */
  private evict(now: number): void {
    for (const [id, s] of this.byId) {
      if (now - s.touchedAt > this.ttlMs) this.byId.delete(id);
    }
    while (this.byId.size > this.maxConversations) {
      const oldest = this.byId.keys().next().value;
      if (oldest === undefined) break;
      this.byId.delete(oldest);
    }
  }

  /** A read-only MemoryState view for focus resolution and context assembly. */
  state(id: ConversationId): MemoryState {
    const s = this.ensure(id);
    return { workingSet: s.workingSet, focusStack: s.focusStack, lastPresentedList: s.lastPresentedList };
  }

  /** Caches a successful tool output under the airport codes it carries, so follow-ups reuse it. */
  record(id: ConversationId, toolName: string, output: JsonValue): void {
    const s = this.ensure(id);
    for (const [code, patch] of airportRecordsFrom(toolName, output)) {
      const prev = s.workingSet.get(code);
      s.workingSet.delete(code);
      s.workingSet.set(code, { ...prev, airportCode: code, ...patch, lastReferencedTurn: s.turn });
    }
    while (s.workingSet.size > this.maxRecords) {
      const oldest = s.workingSet.keys().next().value;
      if (oldest === undefined) break;
      s.workingSet.delete(oldest);
    }
  }

  /** After a turn: count it and move the referenced codes to the front of the focus stack. */
  commitFocus(id: ConversationId, codes: readonly string[], presentedList?: readonly string[]): void {
    const s = this.ensure(id);
    s.turn += 1;
    if (codes.length > 0) s.focusStack = [...new Set([...codes, ...s.focusStack])].slice(0, MAX_FOCUS_STACK);
    if (presentedList !== undefined && presentedList.length > 0) s.lastPresentedList = [...presentedList];
  }
}

type JsonRecord = { readonly [key: string]: JsonValue };
const asObj = (v: JsonValue | undefined): JsonRecord | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? v : null);

/** Pulls { code -> partial AirportRecord } out of a tool output, for the tools that carry airport data. */
export function airportRecordsFrom(toolName: string, output: JsonValue): Array<[string, Partial<AirportRecord>]> {
  const out: Array<[string, Partial<AirportRecord>]> = [];
  const o = asObj(output);
  if (o === null) return out;
  if (toolName === "get_enplanements" && typeof o.airportCode === "string") {
    out.push([o.airportCode.toUpperCase(), { enplanements: output }]);
  } else if (toolName === "get_airport_by_code" && typeof o.code === "string") {
    out.push([o.code.toUpperCase(), { airport: output as unknown as NonNullable<AirportRecord["airport"]> }]);
  } else if (toolName === "score_airports" && Array.isArray(o.ranking)) {
    // The scoring path (#42): each ranked airport's score, with the mode it was scored in.
    for (const entry of o.ranking) {
      const e = asObj(entry);
      if (e !== null && typeof e.airportCode === "string") out.push([e.airportCode.toUpperCase(), { score: { mode: o.mode ?? null, ...e } }]);
    }
  }
  return out;
}
