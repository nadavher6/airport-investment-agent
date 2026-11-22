import type { JsonValue } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { INVESTMENT_KPIS } from "../../scoring/investmentScore.ts";
import {
  CATEGORY_TOOLS,
  CATEGORY_UNITS,
  MAX_CATEGORY_CODES,
  getCongestionTool,
  getGrowthTool,
  getLongHaulShareTool,
  getUnmetDemandTool,
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
    expect(out).toMatchObject({ category: key, label: def.label, weight: def.weight, scale: def.scale.kind, notFound: [] });
    expect(out).not.toHaveProperty("mode"); // #75: no modes, every score is a fixed scale
    expect(out.airports.map((a) => a.airportCode)).toEqual(["LAX", "SNA"]);
    for (const a of out.airports) {
      // get_growth also carries the yearly series and trend facts (#67); the other three are only the category.
      const keys = ["airportCode", "available", "evidence", "name", "raw", "subScore", ...(key === "growth" ? ["growth"] : [])];
      expect(Object.keys(a).sort()).toEqual(keys.sort());
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
});

describe("golden: each category tool equals score_airports' breakdown (#61)", () => {
  // Several airports incl. a missing value: 2A3 (no T-100) and 1G4 (no CAGR).
  const CODES = ["LAX", "SNA", "ATL", "2A3", "1G4"];

  it.each(TOOL_KEYS)("%# tool([codes]) == score_airports([codes]) (the whole set, #75): no category depends on the compared set", async (tool, key) => {
    const out = await call(tool, CODES);
    const all = await score(CODES);
    for (const a of out.airports) {
      const s = entry(all, a.airportCode, key);
      expect(a.subScore).toBe(s.subScore);
      expect(a.available).toBe(s.available);
      expect(a.evidence).toEqual(s.evidence);
    }
  });

  it.each(TOOL_KEYS)("%# tool([codes]) == score_airports([code]) for every airport (raw, sub-score, evidence)", async (tool, key) => {
    const out = await call(tool, CODES);
    for (const a of out.airports) {
      const s = entry(await score([a.airportCode]), a.airportCode, key);
      expect(a.subScore).toBe(s.subScore);
      expect(a.available).toBe(s.available);
      expect(a.raw).toBe(s.available ? s.evidence.value : null);
      expect(a.evidence).toEqual(s.evidence);
    }
  });

  it("pins long-haul (#57: share out of 50%) to score_airports with one code and many: LAX 30.8% -> 61.6", async () => {
    const out = await call(getLongHaulShareTool, ["LAX", "SNA", "ATL"]);
    expect(out.scale).toBe("percent");
    const lax = out.airports.find((a) => a.airportCode === "LAX")!;
    expect(lax.raw).toBe(30.8);
    expect(lax.subScore).toBe(61.6);
    const many = await score(["LAX", "SNA", "ATL"]);
    for (const a of out.airports) {
      expect(a.subScore).toBe(entry(many, a.airportCode, "long_haul").subScore);
      expect(a.subScore).toBe(entry(await score([a.airportCode]), a.airportCode, "long_haul").subScore);
    }
  });

  it("pins LAX / SNA / ATL unmet demand (percent scale) to the same numbers in score_airports", async () => {
    const out = await call(getUnmetDemandTool, ["LAX", "SNA", "ATL"]);
    const many = await score(["LAX", "SNA", "ATL"]);
    for (const a of out.airports) {
      expect(a.subScore).toBe(entry(many, a.airportCode, "unmet_demand").subScore);
      expect(a.subScore).toBe(Math.min(100, Math.round((a.raw ?? NaN) * 10) / 10));
    }
  });
});

describe("the description and unit the model sees (#61 review)", () => {
  it.each(TOOL_KEYS)("%# the description states the fixed scale and drops #65's 2+ codes caveat (#75)", (tool) => {
    const d = tool.description.replace(/\s+/g, " ");
    expect(d).toContain("FIXED scale on the airport's own numbers");
    expect(d).toContain("exactly the same number as this category in score_airports (with one code or many)");
    expect(d).not.toMatch(/relative|min-?max|winsor|rescale|2\+ codes|against all US airports/i);
  });

  it("every category returns its unit; percent-scale categories are in %", async () => {
    expect(CATEGORY_UNITS).toEqual({ congestion: "%", unmet_demand: "%", long_haul: "%", growth: "% per year" });
    for (const [tool, key] of TOOL_KEYS) {
      const out = await call(tool, ["LAX"]);
      expect(out.unit).toBe(CATEGORY_UNITS[key]);
      const def = INVESTMENT_KPIS.find((k) => k.key === key)!;
      if (def.scale.kind === "percent") expect(out.unit).toBe("%");
    }
  });
});
