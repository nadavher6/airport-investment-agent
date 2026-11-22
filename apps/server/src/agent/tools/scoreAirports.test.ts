import { describe, expect, it } from "vitest";
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
  return r.output as unknown as { mode: string; ranking: Ranked[]; notFound: string[] };
}

describe("score_airports tool", () => {
  it("is on the Tool contract with an example input", () => {
    expect(scoreAirportsTool.name).toBe("score_airports");
    expect(scoreAirportsTool.exampleInput).toEqual({ airport_codes: ["LAX", "SFO", "DEN"] });
  });

  it("returns final score, all four sub-scores, and evidence for one code (absolute mode)", async () => {
    const { mode, ranking } = await rank(["LAX"]);
    expect(mode).toBe("absolute");
    const lax = ranking[0]!;
    expect(lax.airportCode).toBe("LAX");
    expect(lax.score).toBeGreaterThan(0);
    expect(lax.coverage).toBe(1);

    for (const cat of Object.values(lax.breakdown)) {
      expect(cat.evidence.formula.length).toBeGreaterThan(0);
      expect(cat.evidence.explanation.length).toBeGreaterThan(0);
      expect(cat.subScore).not.toBeNull(); // all four computed now
    }

    // contributions sum to the final score
    const sum = Object.values(lax.breakdown).reduce((s, c) => s + (c.contribution ?? 0), 0);
    expect(Math.round(sum * 10) / 10).toBe(lax.score);
  });

  it("evidence carries the real T-100 inputs", async () => {
    const { ranking } = await rank(["DEN"]);
    const den = ranking[0]!;
    expect(den.breakdown.growth!.evidence.inputs).toHaveProperty("cagr5yr");
    expect(den.breakdown.unmet_demand!.evidence.inputs).toHaveProperty("loadFactor");
    expect(den.breakdown.long_haul!.evidence.inputs).toHaveProperty("internationalShare");
    expect(den.breakdown.congestion!.evidence.inputs).toHaveProperty("departures");
  });

  it("ranks multiple codes relative to each other, high-to-low, with notFound", async () => {
    const { mode, ranking, notFound } = await rank(["LAX", "DEN", "ZZZ"]);
    expect(mode).toBe("relative");
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
    const { mode, ranking, notFound } = await rank(["LAX", "lax", " Lax ", "zzz", "ZZZ"]);
    expect(ranking.map((r) => r.airportCode)).toEqual(["LAX"]);
    expect(mode).toBe("absolute");
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
});
