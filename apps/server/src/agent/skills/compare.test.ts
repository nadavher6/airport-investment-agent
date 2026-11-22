import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPARE_SKILL, usesCompareSkill } from "./compare.ts";

/** The real score_airports outputs the examples were written from (LAX+SNA and ATL+ORD+DFW+DEN, PR #38 data). */
const FIXTURE_TEXT = readFileSync(new URL("./fixtures/compareScores.json", import.meta.url), "utf8");
const FIXTURE = JSON.parse(FIXTURE_TEXT) as Record<"two" | "four", { ranking: { score: number }[] }>;

/** Every number in a text, thousands separators removed ("266,820" -> 266820, "-2.5%" -> -2.5). */
const numbersIn = (text: string): number[] => [...text.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")));

/** The examples section (from the first "## Example" heading to the end). */
const EXAMPLES = COMPARE_SKILL.slice(COMPARE_SKILL.indexOf("## Example"));

describe("the compare skill (#46)", () => {
  it("exists, with the reasoning order, the formatting rules and two examples", () => {
    for (const text of ["**Verdict first:**", "**Why:**", "**Trade-offs:**", "**Honesty:**", "**Close:**", "do not retype the score table", "```compare", "**Never invent numbers.**", "## Example: 2 airports", "## Example: 4 airports"]) {
      expect(COMPARE_SKILL).toContain(text);
    }
  });

  it("its examples only use numbers present in their fixture (or a gap between two final scores, or a rank)", () => {
    const allowed = new Set(numbersIn(FIXTURE_TEXT));
    const scores = [...FIXTURE.two.ranking, ...FIXTURE.four.ranking].map((r) => r.score);
    const gaps = new Set(scores.flatMap((a) => scores.map((b) => Math.round((a - b) * 10) / 10)));
    const ranks = new Set([...EXAMPLES.matchAll(/#(\d)/g)].map((m) => Number(m[1])));
    const unknown = numbersIn(EXAMPLES).filter((n) => !allowed.has(n) && !gaps.has(n) && !ranks.has(n));
    expect(unknown).toEqual([]);
  });

  it.each([
    [0, false],
    [1, false],
    [2, true],
    [3, true],
    [5, true],
    [6, false],
  ])("is used for %i scored airports: %s", (n, used) => {
    expect(usesCompareSkill(n)).toBe(used);
  });
});
