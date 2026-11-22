import type { MemoryState } from "./types.ts";

/**
 * Deterministic focus / reference resolution (tasks/05-memory.md §4).
 * Decides which airport codes a turn is about, from explicit mentions or anaphora
 * resolved against the focus stack / last presented list. No LLM call.
 */

const MAX_FOCUS_STACK = 8;

/**
 * Minimal city / region -> IATA gazetteer. This is a starter set; replace or extend it
 * with the airports reference dataset (see tasks/02 / the enplanements work) so every
 * US commercial airport resolves.
 */
const GAZETTEER: Record<string, readonly string[]> = {
  "los angeles": ["LAX"],
  "san francisco": ["SFO"],
  denver: ["DEN"],
  boston: ["BOS"],
  seattle: ["SEA"],
  atlanta: ["ATL"],
  chicago: ["ORD", "MDW"],
  "new york": ["JFK", "LGA", "EWR"],
  // regions
  "pacific northwest": ["SEA", "PDX"],
  "bay area": ["SFO", "OAK", "SJC"],
};

// Longest keys first so "san francisco" wins before any substring could.
const GAZETTEER_ENTRIES = Object.entries(GAZETTEER).sort((a, b) => b[0].length - a[0].length);

/** 0-based position into the last presented list; `last` -> sentinel -1. */
const ORDINALS: Record<string, number> = {
  first: 0,
  "1st": 0,
  top: 0,
  second: 1,
  "2nd": 1,
  third: 2,
  "3rd": 2,
  fourth: 3,
  "4th": 3,
  fifth: 4,
  "5th": 4,
  last: -1,
};

const CAPS_CODE = /\b[A-Z]{3}\b/g;
const ADDITIVE = /\b(add|also|include|as well|along with|plus)\b/i;
const PRONOUN_PLURAL = /\b(them|those|these|both|all|the (?:airports|ones|hubs))\b/i;
const PRONOUN_SINGULAR = /\b(it|that|this|the (?:airport|one|hub|asset))\b/i;

/** All-caps 3-letter English words that look like codes but are not airports. */
const CODE_STOPWORDS = new Set([
  "THE", "AND", "FOR", "ARE", "WHY", "HOW", "ADD", "YOU", "CAN", "WHO", "NOT",
  "BUT", "ALL", "ANY", "ITS", "OUR", "WAS", "HAS", "GET", "TOP", "ONE", "TWO",
]);

const unique = (codes: readonly string[]): string[] => [...new Set(codes)];

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Explicit airport codes in the message: all-caps 3-letter tokens + gazetteer phrases. */
export function extractExplicitCodes(message: string): string[] {
  const codes: string[] = [];
  for (const m of message.matchAll(CAPS_CODE)) {
    if (!CODE_STOPWORDS.has(m[0])) codes.push(m[0]);
  }
  for (const [name, mapped] of GAZETTEER_ENTRIES) {
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(message)) codes.push(...mapped);
  }
  return unique(codes);
}

function findOrdinal(message: string): number | undefined {
  const lower = message.toLowerCase();
  for (const [word, index] of Object.entries(ORDINALS)) {
    if (new RegExp(`\\b${escapeRegExp(word)}\\b`).test(lower)) return index;
  }
  return undefined;
}

export interface FocusResolution {
  /** Target airport codes for this turn (deduped, ordered: most relevant first). */
  readonly codes: string[];
  /** Updated focus stack (targets moved to the front, capped). */
  readonly focusStack: string[];
  /** A reference was made ("it", "the second one") but nothing could be resolved. */
  readonly ambiguous: boolean;
}

/**
 * Resolve which airports an in_scope message targets.
 * Precedence: explicit codes/cities > ordinal ("the second one") > plural pronoun
 * ("both/them") > singular pronoun ("it/that airport"). No reference -> no codes.
 */
export function resolveFocus(message: string, state: MemoryState): FocusResolution {
  const explicit = extractExplicitCodes(message);
  let codes: string[] = [];
  let ambiguous = false;

  if (explicit.length > 0) {
    // "add Denver" / "also include BOS" keeps the current focus and extends it.
    codes = ADDITIVE.test(message) ? unique([...state.focusStack, ...explicit]) : explicit;
  } else {
    const ordinal = findOrdinal(message);
    if (ordinal !== undefined) {
      const list = state.lastPresentedList;
      const picked = list[ordinal === -1 ? list.length - 1 : ordinal];
      if (picked) codes = [picked];
      else ambiguous = true;
    } else if (PRONOUN_PLURAL.test(message)) {
      const list = state.lastPresentedList.length ? state.lastPresentedList : state.focusStack;
      if (list.length) codes = [...list];
      else ambiguous = true;
    } else if (PRONOUN_SINGULAR.test(message)) {
      if (state.focusStack[0]) codes = [state.focusStack[0]];
      else ambiguous = true;
    }
    // else: a general question with no entity or reference -> codes stays [].
  }

  const focusStack = unique([...codes, ...state.focusStack]).slice(0, MAX_FOCUS_STACK);
  return { codes, focusStack, ambiguous };
}
