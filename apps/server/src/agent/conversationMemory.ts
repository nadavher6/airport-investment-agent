import type { JsonValue } from "@airport/shared";
import type { AirportRecord, MemoryState } from "./memory/types.ts";

/**
 * Per-conversation memory store: the structured tool results (by airport code) and the focus
 * stack, kept across turns so follow-ups ("why is it higher?") reuse data instead of re-fetching
 * (tasks/05-memory.md). The server is stateless per request, so conversations are keyed by a stable
 * hash of their first user message.
 */
interface ConversationState {
  readonly workingSet: Map<string, AirportRecord>;
  focusStack: string[];
  lastPresentedList: string[];
  turn: number;
}

/** Stable-ish id for a conversation from its first user message (djb2). */
export function conversationId(messages: readonly { role: string; content: string }[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "";
  let h = 5381;
  for (let i = 0; i < first.length; i++) h = (h * 33) ^ first.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export class ConversationMemory {
  private readonly byId = new Map<string, ConversationState>();

  private ensure(id: string): ConversationState {
    let s = this.byId.get(id);
    if (!s) {
      s = { workingSet: new Map(), focusStack: [], lastPresentedList: [], turn: 0 };
      this.byId.set(id, s);
    }
    return s;
  }

  /** A read-only MemoryState view for focus resolution + context assembly. */
  state(id: string): MemoryState {
    const s = this.ensure(id);
    return { workingSet: s.workingSet, focusStack: s.focusStack, lastPresentedList: s.lastPresentedList };
  }

  /** Cache a tool result under any airport codes it carries (so follow-ups reuse it). */
  record(id: string, toolName: string, output: JsonValue): void {
    const s = this.ensure(id);
    for (const [code, patch] of airportRecordsFrom(toolName, output)) {
      const prev = s.workingSet.get(code);
      s.workingSet.set(code, { ...prev, airportCode: code, ...patch, lastReferencedTurn: s.turn });
    }
  }

  /** After a turn: move the referenced codes to the front of the focus stack. */
  commitFocus(id: string, codes: readonly string[]): void {
    const s = this.ensure(id);
    s.turn += 1;
    if (codes.length > 0) s.focusStack = [...new Set([...codes, ...s.focusStack])].slice(0, 8);
  }
}

/** Pull { code -> partial AirportRecord } out of a tool output, for the tools that carry airport data. */
function airportRecordsFrom(toolName: string, output: JsonValue): Array<[string, Partial<AirportRecord>]> {
  const out: Array<[string, Partial<AirportRecord>]> = [];
  const asObj = (v: JsonValue): Record<string, JsonValue> | null =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, JsonValue>) : null;

  const o = asObj(output);
  if (!o) return out;

  if (toolName === "get_enplanements" && typeof o.airportCode === "string") {
    out.push([o.airportCode.toUpperCase(), { enplanements: output }]);
  } else if (toolName === "get_airport_by_code" && typeof o.code === "string") {
    out.push([o.code.toUpperCase(), { airport: output as unknown as NonNullable<AirportRecord["airport"]> }]);
  }
  return out;
}
