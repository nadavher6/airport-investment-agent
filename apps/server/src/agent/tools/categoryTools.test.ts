import type { JsonValue } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { INVESTMENT_KPIS } from "../../scoring/investmentScore.ts";
import {
  CATEGORY_TOOLS,
  MAX_CATEGORY_CODES,
  getCongestionTool,
  getGrowthTool,
  getLongHaulShareTool,
  getUnmetDemandTool,
  scaleKind,
  type CategoryKey,
  type CategoryOutput,
} from "./categoryTools.ts";
import { TOOLS } from "./registry.ts";
import { scoreAirportsTool } from "./scoreAirports.ts";
import type { RegisteredTool } from "./tool.ts";

const ctx = { signal: new AbortController().signal };

const TOOL_KEYS: ReadonlyArray<readonly [RegisteredTool, CategoryKey]> = [
  [getCongestionTool, "congestion"],
  [getUnmetDemandTool, "unmet_demand"],
  [getLongHaulShareTool, "long_haul"],
  [getGrowthTool, "growth"],
];

interface Breakdown {
  available: boolean;
  subScore: number | null;
  evidence: { value: number | null } & Record<string, unknown>;
}
interface ScoreOutput {
  mode: string;
  ranking: Array<{ airportCode: string; breakdown: Record<string, Breakdown> }>;
  notFound: string[];
}

async function call(tool: RegisteredTool, codes: JsonValue): Promise<CategoryOutput> {
  const r = await tool.run({ airport_codes: codes }, ctx);
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.output as unknown as CategoryOutput;
}

async function score(codes: string[]): Promise<ScoreOutput> {
  const r = await scoreAirportsTool.run({ airport_codes: codes }, ctx);
  if (!r.ok) throw new Error("expected ok");
  return r.output as unknown as ScoreOutput;
}

const entry = (out: ScoreOutput, code: string, key: CategoryKey): Breakdown => {
  const a = out.ranking.find((r) => r.airportCode === code);
  if (!a) throw new Error(`no ${code} in score_airports`);
  return a.breakdown[key]!;
};

describe("per-category tools (#61)", () => {
  it("are four tools on the Tool contract, registered in TOOLS after score_airports", () => {
    expect(CATEGORY_TOOLS.map((t) => t.name)).toEqual(["get_congestion", "get_unmet_demand", "get_long_haul_share", "get_growth"]);
    const names = TOOLS.map((t) => t.name);
    expect(names.slice(names.indexOf("score_airports") + 1)).toEqual(CATEGORY_TOOLS.map((t) => t.name));
    for (const t of CATEGORY_TOOLS) {
      expect(t.inputJsonSchema).toMatchObject({ required: ["airport_codes"] });
      expect(t.description).toMatch(/score_airports/);
    }
  });

  it.each(TOOL_KEYS)("%# valid codes: only that category, the issue's shape, codes upper-cased and deduped", async (tool, key) => {
    const out = await call(tool, ["lax", "SNA", "LAX"]);
    const def = INVESTMENT_KPIS.find((k) => k.key === key)!;
    expect(out).toMatchObject({ category: key, label: def.label, weight: def.weight, mode: "absolute", notFound: [] });
    expect(out.airports.map((a) => a.airportCode)).toEqual(["LAX", "SNA"]);
    for (const a of out.airports) {
      expect(Object.keys(a).sort()).toEqual(["airportCode", "available", "evidence", "name", "raw", "subScore"]);
      expect(a.available).toBe(true);
      expect(a.evidence?.value).toBe(a.raw);
      expect(a.evidence?.formula.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(out)).not.toMatch(/"contribution"|"breakdown"|"score":/);
  });

  it.each(TOOL_KEYS)("%# unknown codes go to notFound; none found is not_found", async (tool) => {
    const out = await call(tool, ["LAX", "ZZZ"]);
    expect(out.notFound).toEqual(["ZZZ"]);
    expect(out.airports.map((a) => a.airportCode)).toEqual(["LAX"]);
    const none = await tool.run({ airport_codes: ["ZZZ", "QQQ"] }, ctx);
    expect(none).toEqual({ ok: false, error: { code: "not_found", message: "None of the airport codes were found: ZZZ, QQQ." } });
  });

  it.each(TOOL_KEYS)("%# more than 5 distinct codes is invalid_input; 5 (with repeats) is fine", async (tool) => {
    const six = await tool.run({ airport_codes: ["LAX", "SNA", "ATL", "SFO", "JFK", "DEN"] }, ctx);
    expect(six.ok).toBe(false);
    if (!six.ok) {
      expect(six.error.code).toBe("invalid_input");
      expect(six.error.message).toContain(`max ${MAX_CATEGORY_CODES} airports`);
    }
    const five = await call(tool, ["LAX", "SNA", "ATL", "SFO", "JFK", "lax"]);
    expect(five.airports).toHaveLength(5);
    expect((await tool.run({ airport_codes: [] }, ctx)).ok).toBe(false);
    expect((await tool.run({ airport_codes: ["LAX"], extra: 1 }, ctx)).ok).toBe(false);
  });

  it("a missing value is available: false with null raw and sub-score, as in score_airports", async () => {
    // 2A3 has no BTS T-100 record (congestion missing); 1G4 has no 5-year CAGR (growth missing).
    const congestion = await call(getCongestionTool, ["2A3"]);
    expect(congestion.airports[0]).toMatchObject({ airportCode: "2A3", available: false, raw: null, subScore: null });
    expect(entry(await score(["2A3"]), "2A3", "congestion")).toMatchObject({ available: false, subScore: null });
    const growth = await call(getGrowthTool, ["1G4"]);
    expect(growth.airports[0]).toMatchObject({ airportCode: "1G4", available: false, raw: null, subScore: null });
    expect(growth.airports[0]!.evidence?.explanation).toMatch(/No 5-year CAGR/);
  });

  it("scaleKind reads the engine's scale on main and after #54 / #57", () => {
    expect(scaleKind("percent")).toBe("percent");
    expect(scaleKind({ kind: "percent", fullAt: 0.5 })).toBe("percent");
    expect(scaleKind({ kind: "minmax" })).toBe("minmax");
    expect(scaleKind("minmax")).toBe("minmax");
    expect(scaleKind(undefined)).toBe("minmax");
  });
});

describe("golden: each category tool equals score_airports' breakdown (#61)", () => {
  // Several airports incl. a missing value: 2A3 (no T-100) and 1G4 (no CAGR).
  const CODES = ["LAX", "SNA", "ATL", "2A3", "1G4"];

  it.each(TOOL_KEYS)("%# absolute mode: tool([codes]) == score_airports([code]) for every airport (raw, sub-score, evidence)", async (tool, key) => {
    const out = await call(tool, CODES);
    for (const a of out.airports) {
      const s = entry(await score([a.airportCode]), a.airportCode, key);
      expect(a.subScore).toBe(s.subScore);
      expect(a.available).toBe(s.available);
      expect(a.raw).toBe(s.available ? s.evidence.value : null);
      expect(a.evidence).toEqual(s.evidence);
    }
  });

  it.each(TOOL_KEYS)("%# relative mode: a percent-scale category equals score_airports([codes]); a min-max one is stated as absolute", async (tool, key) => {
    const out = await call(tool, CODES);
    const relative = await score(CODES);
    expect(relative.mode).toBe("relative");
    const def = INVESTMENT_KPIS.find((k) => k.key === key)!;
    expect(out.scale).toBe(scaleKind(def.scale));
    for (const a of out.airports) {
      const s = entry(relative, a.airportCode, key);
      expect(a.available).toBe(s.available);
      // Percent-scale sub-scores do not depend on the compared set, so they match in both modes.
      if (out.scale === "percent") expect(a.subScore).toBe(s.subScore);
    }
    expect(out.mode).toBe("absolute");
  });

  it("pins LAX / SNA / ATL unmet demand (percent scale) to the same numbers in both modes", async () => {
    const out = await call(getUnmetDemandTool, ["LAX", "SNA", "ATL"]);
    const relative = await score(["LAX", "SNA", "ATL"]);
    for (const a of out.airports) {
      expect(a.subScore).toBe(entry(relative, a.airportCode, "unmet_demand").subScore);
      expect(a.subScore).toBe(Math.min(100, Math.round((a.raw ?? NaN) * 10) / 10));
    }
  });
});
