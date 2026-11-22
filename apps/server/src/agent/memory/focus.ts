import { findAirportsByCityTool } from "../tools/findAirportsByCity.ts";
import { findAirportsByRegionTool } from "../tools/findAirportsByRegion.ts";
import { getAirportByCodeTool } from "../tools/getAirportByCode.ts";
import type { CityResult } from "../../data/places/airports.ts";
import type { MemoryState } from "./types.ts";

/**
 * Deterministic focus / reference resolution (tasks/05-memory.md §4).
 * Decides which airport codes a turn is about, from explicit mentions or anaphora
 * resolved against the focus stack / last presented list. No LLM call.
 */

const MAX_FOCUS_STACK = 8;

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

const ADDITIVE = /\b(add|also|include|as well|along with|plus)\b/i;
const PRONOUN_PLURAL = /\b(them|those|these|both|all|the (?:airports|ones|hubs))\b/i;
const PRONOUN_SINGULAR = /\b(it|that|this|the (?:airport|one|hub|asset))\b/i;

const unique = (codes: readonly string[]): string[] => [...new Set(codes)];

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Longest place name scanned, in words ("salt lake city", "dallas fort worth"). */
const MAX_PLACE_WORDS = 4;
/** Most words of one message scanned for place names (bounds the lookups per turn). */
const MAX_SCANNED_WORDS = 60;
/** find_airports_by_city resolves at most this many names per call (#23's MAX_CITIES). */
const CITY_BATCH = 50;
const WORD = /[\p{L}\p{N}]+(?:['’.][\p{L}\p{N}]+)*/gu;

/** The canonical code when get_airport_by_code (#23) knows the token, in any case; else undefined. */
function confirmCode(token: string): string | undefined {
  const found = getAirportByCodeTool.run({ code: token });
  return "error" in found ? undefined : found.code;
}

interface Span {
  readonly start: number;
  readonly end: number; // exclusive
  readonly text: string;
}

const cityCodes = (result: CityResult | undefined): string[] => (result ? result.airports.map((a) => a.code) : []);

/**
 * Explicit airports in the message, in message order. Place names (1-4 word phrases) are resolved
 * with find_airports_by_region and find_airports_by_city (#23), longest phrase first, so
 * "San Diego" is a city and not the code SAN. Leftover 3-letter words are kept only when
 * get_airport_by_code (#23) confirms them. There is no local table of places or codes.
 */
export function extractExplicitCodes(message: string): string[] {
  const words = [...message.matchAll(WORD)].map((m) => m[0]).slice(0, MAX_SCANNED_WORDS);
  const spans: Span[] = [];
  for (let len = Math.min(MAX_PLACE_WORDS, words.length); len >= 1; len--) {
    for (let start = 0; start + len <= words.length; start++) {
      spans.push({ start, end: start + len, text: words.slice(start, start + len).join(" ") });
    }
  }

  const cityResults: Record<string, CityResult> = {};
  const names = [...new Set(spans.map((sp) => sp.text))];
  for (let i = 0; i < names.length; i += CITY_BATCH) {
    Object.assign(cityResults, findAirportsByCityTool.run({ cities: names.slice(i, i + CITY_BATCH) }).results);
  }

  const used = new Array<boolean>(words.length).fill(false);
  const hits: { start: number; codes: string[] }[] = [];
  for (const sp of spans) {
    if (used.slice(sp.start, sp.end).some(Boolean)) continue;
    let codes: string[] = [];
    const region = findAirportsByRegionTool.run({ region: sp.text });
    if (region.matchedAs === "region") {
      for (const city of region.cities) codes.push(...cityCodes(region.results[city]));
    } else {
      codes = cityCodes(cityResults[sp.text]);
    }
    if (codes.length === 0 && sp.end - sp.start === 1 && /^[A-Za-z]{3}$/.test(sp.text)) {
      const code = confirmCode(sp.text);
      if (code !== undefined) codes = [code];
    }
    if (codes.length > 0) {
      used.fill(true, sp.start, sp.end);
      hits.push({ start: sp.start, codes });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  return unique(hits.flatMap((h) => h.codes));
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
  /** Codes the user named in this message. Pass to selectFocusedRecords as `pinned` so the K-cap keeps them. */
  readonly explicitCodes: string[];
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
    // "add Denver" / "also include BOS" keeps the current focus and extends it. The new codes go
    // first, so the K-cap and the focus-stack cap trim the oldest focus, never the new airport.
    codes = ADDITIVE.test(message) ? unique([...explicit, ...state.focusStack]) : explicit;
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
  return { codes, focusStack, explicitCodes: explicit, ambiguous };
}
