import { enplanementsDataset } from "../../data/enplanements/dataset.ts";
import { findAirportsByCity, findAirportsByRegion, getAirportByCode } from "../../data/places/airports.ts";
import type { CityResult } from "../../data/places/airports.ts";
import { metrosFile, regionsFile } from "../../data/places/files.ts";
import { normalizePlace } from "../../data/places/text.ts";
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
/**
 * An ordinal counts only as a reference to a list item: "the second one", "the last airport",
 * "#2". "last year", "first quarter" and "top airports" are not references.
 */
const ORDINAL_REF = /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|last)\s+(?:one|airport|hub|option|pick|entry)\b/i;
const HASH_REF = /(?:^|[\s(])#\s?(\d{1,2})\b/;
/** Plural references to a list: "them", "those airports", "both of them", a trailing "both". */
const PRONOUN_PLURAL =
  /\b(?:them|(?:those|these|the same) (?:ones|airports|hubs)|both (?:of them|airports|hubs)|both(?=\s*(?:[?.!,]|$)))/i;
/** Singular references that name the referent: "that airport", "this one", "the same hub". */
const PRONOUN_SINGULAR = /\b(?:that|this|the same) (?:one|airport|hub)\b/i;
/**
 * Bare "it" / "its": often a dummy subject ("is it possible..."), so it only reuses the top of the
 * focus stack when there is one and never flags ambiguity on its own.
 */
const PRONOUN_IT = /\b(?:it|its)\b/i;

const unique = (codes: readonly string[]): string[] => [...new Set(codes)];


/** Longest place name scanned, in words ("salt lake city", "dallas fort worth"). */
const MAX_PLACE_WORDS = 4;
/** Most words of one message scanned for airports (bounds the work per turn). */
const MAX_SCANNED_WORDS = 60;
const WORD = /[\p{L}\p{N}]+(?:['’.][\p{L}\p{N}]+)*/gu;

// Built once at module load from #23's data, so a turn costs only Map/Set lookups (no fuzzy search).
/** Every code get_airport_by_code can confirm (a pre-filter; hits are still confirmed by the tool). */
const KNOWN_CODES: ReadonlySet<string> = new Set(
  Object.values(enplanementsDataset.airports).map((r) => r.airportCode.toUpperCase()),
);
/** Normalized place text -> which #23 tool resolves it. Same keys as #23 (normalizePlace). */
const PLACE_KIND: ReadonlyMap<string, "region" | "city"> = (() => {
  const m = new Map<string, "region" | "city">();
  for (const r of Object.values(enplanementsDataset.airports)) {
    const key = normalizePlace(r.city);
    if (key !== "") m.set(key, "city");
  }
  for (const [name, metro] of Object.entries(metrosFile.metros)) {
    for (const text of [name, ...metro.aliases]) m.set(normalizePlace(text), "city");
  }
  for (const [name, region] of Object.entries(regionsFile.regions)) {
    for (const text of [name, ...region.aliases]) m.set(normalizePlace(text), "region");
  }
  m.delete("");
  return m;
})();

/** Words before a lowercase token that mark it as an airport ("compare lax", "fly to bos"). */
const CUE_BEFORE: readonly (readonly string[])[] = [
  ["compare"],
  ["vs"],
  ["versus"],
  ["fly", "to"],
  ["fly", "from"],
  ["flights", "to"],
  ["flights", "from"],
  ["flights", "out", "of"],
];
/** Words right after a lowercase token that mark it as an airport ("den airport", "lax vs"). */
const CUE_AFTER: ReadonlySet<string> = new Set(["airport", "airports", "vs", "versus"]);

/** The canonical code when get_airport_by_code's lookup (#23) confirms the token; else undefined. */
function confirmCode(token: string): string | undefined {
  const found = getAirportByCode(token);
  return "error" in found ? undefined : found.code;
}

const cityCodes = (result: CityResult | undefined): string[] => (result ? result.airports.map((a) => a.code) : []);

/** Airports for a place key the index matched; the #23 tool lookups return them (a match never hits the fuzzy path). */
function placeCodes(key: string, kind: "region" | "city"): string[] {
  if (kind === "region") {
    const region = findAirportsByRegion(key);
    return region.cities.flatMap((city) => cityCodes(region.results[city]));
  }
  return cityCodes(findAirportsByCity([key]).results[key]);
}

const isUpperCode = (w: string): boolean => /^[A-Z]{3}$/.test(w);
const isCodeShaped = (w: string): boolean => /^[A-Za-z]{3}$/.test(w);

/**
 * Explicit airports in the message, in message order (option B, one pass):
 * - an UPPERCASE 3-letter word is a code when get_airport_by_code confirms it;
 * - otherwise the longest 1-4 word phrase that names a #23 region or city/metro is resolved by
 *   find_airports_by_region / find_airports_by_city ("San Diego", "NYC");
 * - a lowercase or mixed-case 3-letter word is a code only next to an airport cue ("airport",
 *   "fly to/from", "flights to/from/out of", "vs", "compare"), in a comma / "and" list with a
 *   confirmed code, or when it is the whole message ("lax?"); it is still confirmed by the tool.
 */
export function extractExplicitCodes(message: string): string[] {
  const matches = [...message.matchAll(WORD)].slice(0, MAX_SCANNED_WORDS);
  const words = matches.map((m) => m[0]);
  const lower = words.map((w) => w.toLowerCase());
  const norm = words.map((w) => normalizePlace(w));
  /** Codes found at each word index (place hits are stored at their first word). */
  const found = new Map<number, string[]>();
  /** Lowercase/mixed code-shaped words that are known codes, waiting for a cue. */
  const pending: number[] = [];
  const confirmed = new Set<number>();

  for (let i = 0; i < words.length; ) {
    const w = words[i] ?? "";
    if (isUpperCode(w) && KNOWN_CODES.has(w)) {
      const code = confirmCode(w);
      if (code !== undefined) {
        found.set(i, [code]);
        confirmed.add(i);
        i++;
        continue;
      }
    }
    let matched = 0;
    for (let len = Math.min(MAX_PLACE_WORDS, words.length - i); len >= 1 && matched === 0; len--) {
      const key = norm.slice(i, i + len).filter((t) => t !== "").join(" ");
      const kind = key === "" ? undefined : PLACE_KIND.get(key);
      if (kind === undefined) continue;
      const codes = placeCodes(key, kind);
      if (codes.length > 0) {
        found.set(i, codes);
        matched = len;
      }
    }
    if (matched > 0) {
      i += matched;
      continue;
    }
    if (isCodeShaped(w) && KNOWN_CODES.has(w.toUpperCase())) pending.push(i);
    i++;
  }

  const wholeMessage = normalizePlace(message);
  const hasCue = (i: number): boolean =>
    wholeMessage === lower[i] ||
    CUE_AFTER.has(lower[i + 1] ?? "") ||
    CUE_BEFORE.some((cue) => cue.every((c, k) => lower[i - cue.length + k] === c));
  /** Two code words form a list when only a comma, or the word "and", separates them. */
  const linked = (a: number, b: number): boolean => {
    if (b === a + 1) {
      const ma = matches[a];
      const mb = matches[b];
      if (ma === undefined || mb === undefined) return false;
      return message.slice((ma.index ?? 0) + ma[0].length, mb.index ?? 0).includes(",");
    }
    return b === a + 2 && lower[a + 1] === "and";
  };

  const accepted = new Set<number>(confirmed);
  for (const i of pending) if (hasCue(i)) accepted.add(i);
  // Spread acceptance along comma / "and" lists of code words, both directions, until stable.
  const codeWords = [...new Set([...confirmed, ...pending])].sort((x, y) => x - y);
  for (let changed = true; changed; ) {
    changed = false;
    for (let k = 0; k + 1 < codeWords.length; k++) {
      const a = codeWords[k] ?? -1;
      const b = codeWords[k + 1] ?? -1;
      if (!linked(a, b) || accepted.has(a) === accepted.has(b)) continue;
      accepted.add(accepted.has(a) ? b : a);
      changed = true;
    }
  }
  for (const i of pending) {
    if (!accepted.has(i)) continue;
    const code = confirmCode(words[i] ?? "");
    if (code !== undefined) found.set(i, [code]);
  }

  return unique([...found.entries()].sort((x, y) => x[0] - y[0]).flatMap(([, codes]) => codes));
}

/** The list position an ordinal reference points to (`-1` = last), or undefined if there is none. */
function findOrdinal(message: string): number | undefined {
  const word = ORDINAL_REF.exec(message)?.[1]?.toLowerCase();
  if (word !== undefined) return ORDINALS[word];
  const hash = HASH_REF.exec(message)?.[1];
  if (hash !== undefined && Number(hash) >= 1) return Number(hash) - 1;
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
 * Precedence: explicit codes/cities > ordinal ("the second one", "#2") > plural reference
 * ("them", "those airports") > singular reference ("that airport") > bare "it" (focus top only).
 * Ordinals and pronouns resolve only as references to the last list / focus stack.
 * No reference -> no codes.
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
    } else if (PRONOUN_IT.test(message) && state.focusStack[0]) {
      codes = [state.focusStack[0]];
    }
    // else: a general question with no entity or reference -> codes stays [].
  }

  const focusStack = unique([...codes, ...state.focusStack]).slice(0, MAX_FOCUS_STACK);
  return { codes, focusStack, explicitCodes: explicit, ambiguous };
}
