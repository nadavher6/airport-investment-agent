// #75: every score is a fixed scale on the airport's own numbers, so nothing the model reads may describe a
// relative score ("100 = best of this set", "relative mode", min-max, winsorizing), and it must never explain a
// sub-score as a relative 0. A grep over the prompts, the skills and every tool description.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOOLS } from "./tools/registry.ts";

const FORBIDDEN = /relative|best of (this|the|these)\b[^.]*\bset|best of these|min-?max|winsori[sz]|absolute mode|rescal/i;

/** The non-test source and Markdown files of one folder, with their text. */
const filesIn = (dir: string, ext: RegExp): Array<[string, string]> => {
  const url = new URL(`./${dir}/`, import.meta.url);
  return readdirSync(url)
    .filter((f) => ext.test(f) && !f.includes(".test."))
    .map((f) => [`${dir}/${f}`, readFileSync(new URL(f, url), "utf8")]);
};

describe("#75: no relative-scoring wording in what the model reads", () => {
  const texts = [...filesIn("prompts", /\.ts$/), ...filesIn("skills", /\.(md|ts)$/)];

  it("scans the prompts and the skills (grading.md and compare.md included)", () => {
    const names = texts.map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(["prompts/toolLoop.ts", "prompts/grading.ts", "skills/grading.md", "skills/compare.md"]));
  });

  it.each(filesIn("prompts", /\.ts$/).concat(filesIn("skills", /\.(md|ts)$/)))("%s has no relative wording", (_name, text) => {
    expect(text).not.toMatch(FORBIDDEN);
  });

  it.each(TOOLS.map((t) => [t.name, t.description] as const))("the %s description has no relative wording", (_name, description) => {
    expect(description).not.toMatch(FORBIDDEN);
  });

  it("the skills say every score is a fixed scale on the airport's own numbers, growth included", () => {
    const grading = readFileSync(new URL("./skills/grading.md", import.meta.url), "utf8");
    const compare = readFileSync(new URL("./skills/compare.md", import.meta.url), "utf8");
    expect(grading).toContain("**50 + 5 × the growth rate**");
    expect(grading).toContain("never a rank among the compared airports");
    expect(compare).toContain("every score is a fixed scale on the airport's own numbers");
    expect(compare).toContain("Never describe a score as a rank among the compared airports");
  });

  it("the regex catches the old wording (so the test can fail)", () => {
    for (const old of ["Scored relative to each other", "100 = best of this set, not of the US", "for growth, the min-max category", "winsorized at the 5th", "rescales it"]) {
      expect(old).toMatch(FORBIDDEN);
    }
  });
});
