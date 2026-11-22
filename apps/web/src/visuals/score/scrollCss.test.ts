import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/visuals/score/score.css", "utf8");

describe("score table scrolls inside the tool card (#78)", () => {
  it("lets the card body and the table figure shrink to the card", () => {
    expect(css).toMatch(/\.tool-card__score\s*{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.score-table\s*{[^}]*min-width:\s*0/);
  });
});
