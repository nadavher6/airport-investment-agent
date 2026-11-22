import { readFileSync } from "node:fs";
import { z } from "zod";
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

  it("each example only uses numbers present in its own score result (or the gap between two of its final scores)", () => {
    // Split at the second "## Example"; strip the "#n" rank tokens so the digit is not read as a number.
    const at = EXAMPLES.indexOf("## Example: 4 airports");
    const parts = { two: EXAMPLES.slice(0, at), four: EXAMPLES.slice(at) } as const;
    for (const key of ["two", "four"] as const) {
      const allowed = new Set(numbersIn(JSON.stringify(FIXTURE[key])));
      const scores = FIXTURE[key].ranking.map((r) => r.score);
      const gaps = new Set(scores.flatMap((a) => scores.map((b) => Math.round((a - b) * 10) / 10)));
      const text = parts[key].replace(/^## Example.*$/m, "").replace(/#\d/g, "");
      const unknown = numbersIn(text).filter((n) => !allowed.has(n) && !gaps.has(n));
      expect(unknown, key).toEqual([]);
    }
  });

  it("the compare fence example is valid JSON of the web's compare shape (the web test parses the same file with parseCompare)", () => {
    const bodies = [...COMPARE_SKILL.matchAll(/```compare\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? "");
    expect(bodies).toHaveLength(1);
    const spec = z
      .object({
        columns: z.array(z.string().min(1)).length(2),
        rows: z.array(z.object({ label: z.string().min(1), cells: z.array(z.array(z.object({ kind: z.literal("markdown"), text: z.string() }).strict())) }).strict()).min(1),
      })
      .strict()
      .parse(JSON.parse(bodies[0] ?? ""));
    for (const row of spec.rows) expect(row.cells).toHaveLength(spec.columns.length);
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
