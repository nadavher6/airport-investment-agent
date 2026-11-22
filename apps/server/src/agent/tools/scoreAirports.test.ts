import { describe, expect, it } from "vitest";
import { findAirport } from "../../data/enplanements/dataset.ts";
import { getGrowthTool } from "./categoryTools.ts";
import { MAX_AIRPORT_CODES, scoreAirportsTool } from "./scoreAirports.ts";

const ctx = { signal: new AbortController().signal };

interface Category {
  subScore: number | null;
  contribution: number | null;
  weight: number;
  available: boolean;
  evidence: { formula: string; inputs: Record<string, unknown>; value: number | null; explanation: string };
}
interface Ranked {
  airportCode: string;
  score: number;
  coverage: number;
  missing: string[];
  breakdown: Record<string, Category>;
}

async function rank(codes: string[]) {
  const r = await scoreAirportsTool.run({ airport_codes: codes }, ctx);
  if (!r.ok) throw new Error("expected ok");
  return r.output as unknown as { ranking: Ranked[]; notFound: string[] };
}

describe("score_airports tool", () => {
  it("is on the Tool contract with an example input", () => {
    expect(scoreAirportsTool.name).toBe("score_airports");
    expect(scoreAirportsTool.exampleInput).toEqual({ airport_codes: ["LAX", "SFO", "DEN"] });
  });

  it("returns final score, all four sub-scores, and evidence for one code", async () => {
    const { ranking } = await rank(["LAX"]);
    const lax = ranking[0]!;
    expect(lax.airportCode).toBe("LAX");
    expect(lax.score).toBeGreaterThan(0);
    expect(lax.coverage).toBe(1);

    for (const cat of Object.values(lax.breakdown)) {
      expect(cat.evidence.formula.length).toBeGreaterThan(0);
      expect(cat.evidence.explanation.length).toBeGreaterThan(0);
      expect(cat.subScore).not.toBeNull(); // all four computed now
    }

    // contributions sum to the final score, up to their rounding: each is rounded to one decimal (±0.05), so four
    // of them can differ from the rounded total by up to 0.2 (LAX: 26 + 24.6 + 12.3 + 8.8 = 71.7 vs 71.75 -> 71.8)
    const parts = Object.values(lax.breakdown);
    const sum = parts.reduce((s, c) => s + (c.contribution ?? 0), 0);
    expect(Math.abs(sum - lax.score)).toBeLessThanOrEqual(0.05 * parts.length + 1e-9);
  });

  it("evidence carries the real T-100 inputs", async () => {
    const { ranking } = await rank(["DEN"]);
    const den = ranking[0]!;
    expect(den.breakdown.growth!.evidence.inputs).toHaveProperty("cagr5yr");
    expect(den.breakdown.unmet_demand!.evidence.inputs).toHaveProperty("loadFactor");
    expect(den.breakdown.long_haul!.evidence.inputs).toHaveProperty("internationalShare");
    expect(den.breakdown.congestion!.evidence.inputs).toHaveProperty("departures");
  });

  it("ranks multiple codes high-to-low, with notFound, and no `mode` field (#75)", async () => {
    const out = await rank(["LAX", "DEN", "ZZZ"]);
    const { ranking, notFound } = out;
    expect(out).not.toHaveProperty("mode");
    expect(notFound).toEqual(["ZZZ"]);
    expect(ranking.map((r) => r.airportCode)).toHaveLength(2);
    expect(ranking[0]!.score).toBeGreaterThanOrEqual(ranking[1]!.score);
  });

  it("rejects malformed input with invalid_input (guardrail)", async () => {
    expect(await scoreAirportsTool.run({ airport_codes: [] }, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await scoreAirportsTool.run({}, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });

  it("returns not_found when no code resolves", async () => {
    expect(await scoreAirportsTool.run({ airport_codes: ["ZZZ", "QQQ"] }, ctx)).toMatchObject({
      ok: false,
      error: { code: "not_found" },
    });
  });

  it("upper-cases and dedupes the codes: LAX and lax are one row", async () => {
    const { ranking, notFound } = await rank(["LAX", "lax", " Lax ", "zzz", "ZZZ"]);
    expect(ranking.map((r) => r.airportCode)).toEqual(["LAX"]);
    expect(notFound).toEqual(["ZZZ"]);
  });

  it(`caps the input at ${MAX_AIRPORT_CODES} codes with a clear invalid_input error`, async () => {
    expect(MAX_AIRPORT_CODES).toBe(50);
    const codes = (n: number) => Array.from({ length: n }, (_, i) => `A${String(i).padStart(2, "0")}`);
    const over = await scoreAirportsTool.run({ airport_codes: codes(51) }, ctx);
    expect(over).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    if (over.ok) throw new Error("expected an error");
    expect(over.error.message).toContain("at most 50 airport_codes");
    // exactly 50 is allowed (all unknown here, so the tool says not_found, not invalid_input)
    expect(await scoreAirportsTool.run({ airport_codes: codes(50) }, ctx)).toMatchObject({ ok: false, error: { code: "not_found" } });
  });

  it("#75: LAX growth in a 5-hub comparison equals LAX alone and get_growth([LAX]): 50 + 5 x CAGR, never a relative 0", async () => {
    const HUBS = ["LAX", "DEN", "DFW", "ORD", "ATL"];
    const five = await rank(HUBS);
    const growthOf = (out: { ranking: Ranked[] }, code: string) => out.ranking.find((r) => r.airportCode === code)!.breakdown.growth!.subScore;
    const tool = await getGrowthTool.run({ airport_codes: ["LAX"] }, ctx);
    if (!tool.ok) throw new Error("expected ok");
    const viaTool = (tool.output as unknown as { airports: { subScore: number | null }[] }).airports[0]!.subScore;
    expect(growthOf(five, "LAX")).toBe(GOLDEN_GROWTH.LAX);
    expect(growthOf(await rank(["LAX"]), "LAX")).toBe(GOLDEN_GROWTH.LAX);
    expect(viaTool).toBe(GOLDEN_GROWTH.LAX);
    // Golden for all five: the growth sub-score, each the same alone as in the set.
    for (const code of HUBS) {
      expect(growthOf(five, code), code).toBe(GOLDEN_GROWTH[code as keyof typeof GOLDEN_GROWTH]);
      expect(growthOf(await rank([code]), code), code).toBe(GOLDEN_GROWTH[code as keyof typeof GOLDEN_GROWTH]);
      const cagr = findAirport(code)!.trend.cagr5yr!;
      expect(GOLDEN_GROWTH[code as keyof typeof GOLDEN_GROWTH]).toBe(Math.round(Math.min(100, Math.max(0, 50 + 5 * cagr)) * 10) / 10);
    }
  });
});

/** #75 golden: growth sub-score = 50 + 5 x the real 5-year CAGR (LAX -2.5375 %/yr -> 37.3, DEN 3.5596 -> 67.8; the issue rounds them to -2.5 -> 37.5 and 3.6 -> 68). */
const GOLDEN_GROWTH = { LAX: 37.3, DEN: 67.8, DFW: 67.2, ORD: 44.3, ATL: 48.1 } as const;
