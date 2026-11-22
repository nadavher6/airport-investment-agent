// Text helpers for matching place names typed by a user or an LLM.

/** Trim, lowercase, drop periods and apostrophes, turn other punctuation into spaces, drop the word "the". */
export function normalizePlace(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classic Levenshtein edit distance (insert, delete, substitute; a swap of two letters costs 2). */
export function levenshtein(a: string, b: string): number {
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/**
 * A name is "close" to the query when the distance is at most 2 AND under a quarter of the query's
 * length. The length guard stops a long different word from matching a real one by chance
 * ("Atlantis" is 2 edits from "Atlanta" but is not a typo of it).
 */
export function isCloseMatch(query: string, candidate: string): boolean {
  const d = levenshtein(query, candidate);
  return d >= 1 && d <= 2 && d * 4 < query.length;
}
