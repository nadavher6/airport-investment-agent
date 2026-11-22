import { describe, expect, it } from "vitest";
import { SCORE_FIVE, SCORE_ONE, SCORE_THREE, SCORE_TWO } from "./fixtures";
import { formatScore, formatShare, missingText, parseScoreResult, sortByScore, type RankedAirport } from "./spec";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const lax = (): RankedAirport => {
  const r = parseScoreResult(SCORE_ONE);
  if (!r.ok) throw new Error(r.reason);
  return r.result.ranking[0] as RankedAirport;
};

describe("parseScoreResult", () => {
  it("accepts the 1, 2, 3 and 5 airport fixtures", () => {
    for (const f of [SCORE_ONE, SCORE_TWO, SCORE_THREE, SCORE_FIVE]) expect(parseScoreResult(f).ok).toBe(true);
  });

  it("accepts a partial category with no evidence (evidence is optional in #38)", () => {
    const f = clone(SCORE_ONE) as { ranking: { breakdown: Record<string, Record<string, unknown>> }[] };
    delete f.ranking[0]!.breakdown.growth!.evidence;
    expect(parseScoreResult(f).ok).toBe(true);
  });

  it.each([
    ["null", null],
    ["a string", "LAX 88"],
    ["an array", [SCORE_ONE]],
    ["an empty object", {}],
    ["no ranking", { notFound: [] }],
    ["0 airports", { ranking: [], notFound: ["ZZZ"] }],
    ["no notFound", { ranking: SCORE_ONE.ranking }],
  ])("rejects %s without throwing", (_name, value) => {
    const r = parseScoreResult(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/\S/);
  });

  it("#75: has no mode; an older output that still carries one parses, and the mode is dropped", () => {
    const r = parseScoreResult({ ...SCORE_ONE, mode: "absolute" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).not.toHaveProperty("mode");
  });

  it("rejects a ranking item missing a category, a score above 100, or a string score", () => {
    const noCat = clone(SCORE_ONE) as { ranking: { breakdown: Record<string, unknown> }[] };
    delete noCat.ranking[0]!.breakdown.long_haul;
    expect(parseScoreResult(noCat)).toMatchObject({ ok: false, reason: expect.stringContaining("long_haul") });
    const high = clone(SCORE_ONE) as { ranking: { score: unknown }[] };
    high.ranking[0]!.score = 120;
    expect(parseScoreResult(high).ok).toBe(false);
    high.ranking[0]!.score = "88";
    expect(parseScoreResult(high).ok).toBe(false);
  });
});

describe("sortByScore", () => {
  it("puts the highest final score first and does not change its input", () => {
    const r = parseScoreResult(SCORE_FIVE);
    if (!r.ok) throw new Error(r.reason);
    const shuffled = [...r.result.ranking].reverse();
    const sorted = sortByScore(shuffled);
    expect(sorted.map((a) => a.score)).toEqual([...r.result.ranking.map((a) => a.score)].sort((a, b) => b - a));
    expect(shuffled[0]).toBe(r.result.ranking[r.result.ranking.length - 1]);
  });

  it("keeps the tool's order for a tie, and keeps duplicate codes", () => {
    const a = { ...lax(), airportCode: "AAA", score: 50 };
    const b = { ...lax(), airportCode: "BBB", score: 50 };
    const c = { ...lax(), airportCode: "AAA", score: 70 };
    expect(sortByScore([a, b, c]).map((x) => x.airportCode)).toEqual(["AAA", "AAA", "BBB"]);
    expect(sortByScore([b, a]).map((x) => x.airportCode)).toEqual(["BBB", "AAA"]);
  });
});

describe("formatting", () => {
  it("shows at most 1 decimal and never rounds a 1-decimal value", () => {
    expect(formatScore(71.9)).toBe("71.9");
    expect(formatScore(100)).toBe("100");
    expect(formatScore(0)).toBe("0");
    expect(formatShare(0.8)).toBe("80%");
    expect(formatShare(0.3)).toBe("30%");
  });

  it("says what a missing category needs, from its evidence", () => {
    const growth = lax().breakdown.growth;
    expect(missingText(growth)).toBe(`Not computed — needs ${growth.evidence?.formula}`);
    const { evidence: _e, ...bare } = growth;
    expect(missingText(bare)).toBe("Not computed — needs data that is not available");
  });
});
