// #75: every score is a fixed scale on the airport's own numbers, so the score, category and growth views may not
// say "relative", "best of this set", min-max or "against all US airports" anywhere in their source.
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SCALE_TEXT } from "./spec";

const DIR = resolve(process.cwd(), "src/visuals/score");
const FORBIDDEN = /relative|best of (this|the|these)\b|min-?max|winsori[sz]|all US airports|absolute/i;

/** The views and specs (not the tests, not the recorded tool-output fixtures). */
const SOURCES = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test.") && !/[Ff]ixtures\.ts$/.test(f));

describe("#75: the score UI has no relative-scoring wording", () => {
  it("scans the score, category and growth views and their specs", () => {
    expect(SOURCES).toEqual(expect.arrayContaining(["ScoreView.tsx", "CategoryView.tsx", "GrowthView.tsx", "spec.ts", "categorySpec.ts"]));
  });

  it.each(SOURCES)("%s has no relative wording", (file) => {
    expect(readFileSync(resolve(DIR, file), "utf8")).not.toMatch(FORBIDDEN);
  });

  it("the label says the scale is fixed on each airport's own numbers", () => {
    expect(SCALE_TEXT).toBe("Fixed scales on each airport's own numbers");
    expect("Scored relative to each other").toMatch(FORBIDDEN);
    expect("Scored against all US airports").toMatch(FORBIDDEN);
  });
});
