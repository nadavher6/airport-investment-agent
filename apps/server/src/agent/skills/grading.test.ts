import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INVESTMENT_KPIS } from "../../scoring/investmentScore.ts";
import { GRADING_SKILL, gradingStatusLines, kpiStatusMismatches } from "./grading.ts";

/** The owner's grading text, copied byte for byte from issue #43. */
const OWNER_TEXT = readFileSync(new URL("./fixtures/ownerGradingText.md", import.meta.url), "utf8");

/** Owner lines that describe the computation; they follow INVESTMENT_KPIS instead (checked below). */
const COMPUTATION_LINE = /^\s*- \*\*(How|Proper way|v0 shortcut|Status):\*\*/;

describe("the grading skill (#43)", () => {
  it("keeps every plain-language line of the owner's text word for word", () => {
    const kept = OWNER_TEXT.split("\n").filter((line) => line.trim() !== "" && !COMPUTATION_LINE.test(line));
    // 4 titles, 4 "Meaning", 2 "What it checks" and the 3 long-haul reasons: 13 lines.
    expect(kept.length).toBe(13);
    for (const line of kept) expect(GRADING_SKILL.split("\n"), line).toContain(line);
  });

  it("has the formula, the weights, the method, coverage renormalization and the two modes", () => {
    for (const text of [
      "Score = 0.30·Congestion + 0.30·Unmet demand + 0.20·Long-haul + 0.20·Growth",
      "**Need 0.60**",
      "**Quality 0.40**",
      "winsorized at the 5th and 95th percentile",
      "min-max scaled to 0–100",
      "Coverage renormalization",
      "Relative mode vs. absolute mode",
    ]) {
      expect(GRADING_SKILL).toContain(text);
    }
  });

  it("its How and Status lines match INVESTMENT_KPIS (every KPI computed, same source, same weight)", () => {
    expect(gradingStatusLines(GRADING_SKILL)).toHaveLength(INVESTMENT_KPIS.length);
    expect(kpiStatusMismatches(GRADING_SKILL, INVESTMENT_KPIS)).toEqual([]);
    expect(GRADING_SKILL).toContain("**How:** load factor = passengers ÷ seats");
  });

  it("the check catches the owner's original v0 Status lines and a wrong weight", () => {
    expect(kpiStatusMismatches(OWNER_TEXT, INVESTMENT_KPIS).length).toBeGreaterThan(0);
    const wrongWeight = INVESTMENT_KPIS.map((k) => (k.key === "growth" ? { ...k, weight: 0.25 } : k));
    expect(kpiStatusMismatches(GRADING_SKILL, wrongWeight)).toEqual(['growth: the formula line does not contain "0.25·Growth"']);
  });
});
