import type { ConversationId, JsonValue } from "@airport/shared";
import { ok, type RegisteredTool } from "../tools/tool.ts";
import type { AirportRecord, MemoryState } from "./types.ts";

/**
 * Per-conversation memory (#25, wired in #50): the structured tool results by airport code, the focus stack and
 * the last ranked list, kept across the turns of ONE chat so follow-ups ("what about its 2019 numbers?", "why is
 * LAX higher?") reuse the data instead of fetching it again (tasks/05-memory.md).
 *
 * It is keyed ONLY by the client's `conversationId` (ChatRequest), never by message content, so two chats never
 * share state even when they start with the same text. A turn with no conversationId has no memory: the agent
 * never calls this class for it (no reads, no writes).
 *
 * It is bounded three ways: at most `maxConversations` chats (the least recently used one is evicted), each
 * dropped after `ttlMs` without a turn, and each holding at most `maxRecords` airport records and
 * `maxCachedResults` cached tool outputs (the least recently stored is dropped).
 */
interface ConversationState {
  readonly workingSet: Map<string, AirportRecord>;
  /** Whole tool outputs keyed by `<tool>:<airport codes>` (see `cacheKey`). */
  readonly results: Map<string, JsonValue>;
  focusStack: string[];
  lastPresentedList: string[];
  turn: number;
  touchedAt: number;
}

export interface ConversationMemoryOptions {
  /** Most conversations kept; the least recently used one is evicted past this. */
  readonly maxConversations?: number;
  /** A conversation with no turn for longer than this is dropped. */
  readonly ttlMs?: number;
  /** Most airport records per conversation. */
  readonly maxRecords?: number;
  /** Most cached tool outputs per conversation. */
  readonly maxCachedResults?: number;
  /** The clock, injectable for tests. Default Date.now. */
  readonly now?: () => number;
}

export const DEFAULT_MAX_CONVERSATIONS = 200;
export const DEFAULT_MEMORY_TTL_MS = 60 * 60 * 1000;
export const DEFAULT_MAX_RECORDS_PER_CONVERSATION = 50;
export const DEFAULT_MAX_CACHED_RESULTS = 20;
const MAX_FOCUS_STACK = 8;

/** One conversation's memory, bound to its id: what the agent uses for a turn that has a conversationId. */
export interface ConversationSession {
  /** A read-only snapshot for focus resolution and context assembly. */
  state(): MemoryState;
  /** Caches a successful tool output under the airport codes it carries; returns those codes. */
  record(toolName: string, input: JsonValue, output: JsonValue): string[];
  /** A cached output for this exact tool and airport codes, or undefined. */
  cached(toolName: string, input: JsonValue): JsonValue | undefined;
  /** After a turn: count it and move the touched codes to the front of the focus stack. */
  commit(codes: readonly string[], presentedList?: readonly string[]): void;
}

export class ConversationMemory {
  // A Map keeps insertion order: re-inserting on every access makes the first key the least recently used.
  private readonly byId = new Map<ConversationId, ConversationState>();
  private readonly maxConversations: number;
  private readonly ttlMs: number;
  private readonly maxRecords: number;
  private readonly maxCachedResults: number;
  private readonly now: () => number;

  constructor(options: ConversationMemoryOptions = {}) {
    this.maxConversations = options.maxConversations ?? DEFAULT_MAX_CONVERSATIONS;
    this.ttlMs = options.ttlMs ?? DEFAULT_MEMORY_TTL_MS;
    this.maxRecords = options.maxRecords ?? DEFAULT_MAX_RECORDS_PER_CONVERSATION;
    this.maxCachedResults = options.maxCachedResults ?? DEFAULT_MAX_CACHED_RESULTS;
    this.now = options.now ?? Date.now;
  }

  /** How many conversations are held (for tests and bounds checks). */
  get size(): number {
    return this.byId.size;
  }

  /** Whether a conversation is held (expired ones are not). Does not touch it. */
  has(id: ConversationId): boolean {
    const s = this.byId.get(id);
    return s !== undefined && this.now() - s.touchedAt <= this.ttlMs;
  }

  /** The session for one conversation id; every call on it refreshes the conversation's LRU place and TTL. */
  session(id: ConversationId): ConversationSession {
    return {
      state: () => {
        const s = this.ensure(id);
        return { workingSet: new Map(s.workingSet), focusStack: [...s.focusStack], lastPresentedList: [...s.lastPresentedList] };
      },
      record: (toolName, input, output) => this.record(id, toolName, input, output),
      cached: (toolName, input) => {
        const key = cacheKey(toolName, input);
        return key === undefined ? undefined : this.ensure(id).results.get(key);
      },
      commit: (codes, presentedList) => {
        const s = this.ensure(id);
        s.turn += 1;
        if (codes.length > 0) s.focusStack = [...new Set([...codes, ...s.focusStack])].slice(0, MAX_FOCUS_STACK);
        if (presentedList !== undefined && presentedList.length > 0) s.lastPresentedList = [...presentedList];
      },
    };
  }

  private ensure(id: ConversationId): ConversationState {
    const now = this.now();
    let s = this.byId.get(id);
    if (s !== undefined && now - s.touchedAt > this.ttlMs) s = undefined;
    this.byId.delete(id);
    s ??= { workingSet: new Map(), results: new Map(), focusStack: [], lastPresentedList: [], turn: 0, touchedAt: now };
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
    dropOldest(this.byId, this.maxConversations);
  }

  private record(id: ConversationId, toolName: string, input: JsonValue, output: JsonValue): string[] {
    const s = this.ensure(id);
    const records = airportRecordsFrom(toolName, output);
    for (const [code, patch] of records) {
      const prev = s.workingSet.get(code);
      s.workingSet.delete(code);
      s.workingSet.set(code, { ...prev, airportCode: code, ...patch, lastReferencedTurn: s.turn });
    }
    dropOldest(s.workingSet, this.maxRecords);
    const key = cacheKey(toolName, input);
    if (key !== undefined) {
      s.results.delete(key);
      s.results.set(key, output);
      dropOldest(s.results, this.maxCachedResults);
    }
    return records.map(([code]) => code);
  }
}

/** Deletes the first (least recently set) keys of a Map until it holds at most `max`. */
function dropOldest<K, V>(map: Map<K, V>, max: number): void {
  while (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

type JsonRecord = { readonly [key: string]: JsonValue };
const asObj = (v: JsonValue | undefined): JsonRecord | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? v : null);
const codeOf = (v: JsonValue | undefined): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : undefined);

/**
 * The cache key of a data tool call, by airport code: `get_enplanements:LAX`, `score_airports:LAX,SNA` (distinct,
 * sorted, so the order and case of the codes do not matter). Undefined for other tools or an input of another shape.
 */
export function cacheKey(toolName: string, input: JsonValue): string | undefined {
  const o = asObj(input);
  if (o === null) return undefined;
  const keys = Object.keys(o);
  if (toolName === "get_enplanements" && keys.length === 1) {
    const code = codeOf(o.airport_code);
    return code === undefined ? undefined : `${toolName}:${code}`;
  }
  if (toolName === "score_airports" && keys.length === 1 && Array.isArray(o.airport_codes) && o.airport_codes.length > 0) {
    const codes = o.airport_codes.map(codeOf);
    if (codes.some((c) => c === undefined)) return undefined;
    return `${toolName}:${[...new Set(codes)].sort().join(",")}`;
  }
  return undefined;
}

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
    // Each ranked airport's score, with the mode it was scored in (relative to that set, or absolute).
    for (const entry of o.ranking) {
      const e = asObj(entry);
      if (e !== null && typeof e.airportCode === "string") out.push([e.airportCode.toUpperCase(), { score: { mode: o.mode ?? null, ...e } }]);
    }
  }
  return out;
}

/** The codes of a score_airports ranking, in rank order (the "last presented list" for ordinals). */
export function rankedCodes(toolName: string, output: JsonValue): string[] | undefined {
  if (toolName !== "score_airports") return undefined;
  const codes = airportRecordsFrom(toolName, output).map(([code]) => code);
  return codes.length > 0 ? codes : undefined;
}

/**
 * Wraps a tool for one turn of one conversation: a call whose tool and airport codes are already cached returns
 * the cached output without running the tool (no re-fetch); a successful run is recorded. `onRecord` gets the
 * tool name, its output and the airport codes it carried, hit or run.
 */
export function withMemory(
  tool: RegisteredTool,
  session: ConversationSession,
  onRecord: (toolName: string, output: JsonValue, codes: readonly string[]) => void,
): RegisteredTool {
  return {
    ...tool,
    run: async (rawInput, ctx) => {
      const hit = session.cached(tool.name, rawInput);
      if (hit !== undefined) {
        onRecord(tool.name, hit, airportRecordsFrom(tool.name, hit).map(([code]) => code));
        return ok(hit);
      }
      const result = await tool.run(rawInput, ctx);
      if (result.ok) onRecord(tool.name, result.output, session.record(tool.name, rawInput, result.output));
      return result;
    },
  };
}
