import { readFileSync } from "node:fs";

/**
 * The compare skill (#46): how to compare 2–5 scored airports and format the answer for the UI.
 * Loaded once at start-up; an editable file the owner can rewrite.
 */
export const COMPARE_SKILL: string = readFileSync(new URL("./compare.md", import.meta.url), "utf8");

/** The compare skill is loaded only when this many airports were scored (#46). */
export const COMPARE_MIN_AIRPORTS = 2;
export const COMPARE_MAX_AIRPORTS = 5;

/** True when an answer about `scoredCount` airports gets the compare skill (2–5; 1 is a single-airport report). */
export const usesCompareSkill = (scoredCount: number): boolean =>
  scoredCount >= COMPARE_MIN_AIRPORTS && scoredCount <= COMPARE_MAX_AIRPORTS;
