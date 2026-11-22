import { describe, expect, it } from "vitest";
import { scoreAirportsTool } from "./scoreAirports.ts";

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

  it("returns final score, per-category sub-scores, and evidence for a code", async () => {
    const { ranking } = await rank(["LAX"]);
    const lax = ranking[0]!;
    expect(lax.airportCode).toBe("LAX");
    expect(lax.score).toBeGreaterThan(0);
    expect(lax.coverage).toBe(0.5);

    // every category carries a sub-score slot and evidence (formula + explanation)
    for (const cat of Object.values(lax.breakdown)) {
      expect(cat.evidence.formula.length).toBeGreaterThan(0);
      expect(cat.evidence.explanation.length).toBeGreaterThan(0);
    }
    // computed categories have a numeric sub-score; pending ones are null
    expect(lax.breakdown.unmet_demand!.subScore).not.toBeNull();
    expect(lax.breakdown.growth!.subScore).not.toBeNull();
    expect(lax.breakdown.congestion!.subScore).toBeNull();
    expect(lax.breakdown.long_haul!.subScore).toBeNull();

    // contributions of available categories sum to the final score
    const sum = Object.values(lax.breakdown).reduce((s, c) => s + (c.contribution ?? 0), 0);
    expect(Math.round(sum * 10) / 10).toBe(lax.score);
  });

  it("evidence carries the real inputs (growth CAGR, unmet-demand enplanements)", async () => {
    const { ranking } = await rank(["DEN"]);
    const den = ranking[0]!;
    expect(den.breakdown.growth!.evidence.inputs).toHaveProperty("cagr5yr");
    expect(den.breakdown.unmet_demand!.evidence.inputs).toHaveProperty("enplanements");
  });

  it("ranks multiple codes high-to-low and reports unknown codes in notFound", async () => {
    const { ranking, notFound } = await rank(["LAX", "DEN", "ZZZ"]);
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
});
