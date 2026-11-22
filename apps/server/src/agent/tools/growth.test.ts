import type { JsonValue } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { enplanementsDataset } from "../../data/enplanements/dataset.ts";
import { getGrowthTool, type GrowthOutput } from "./categoryTools.ts";
import { getEnplanementsTool } from "./getEnplanements.ts";
import { growthFacts } from "./growth.ts";
import { scoreAirportsTool } from "./scoreAirports.ts";

const ctx = { signal: new AbortController().signal };
const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

async function growth(codes: JsonValue): Promise<GrowthOutput> {
  const r = await getGrowthTool.run({ airport_codes: codes }, ctx);
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.output as unknown as GrowthOutput;
}

const airport = (out: GrowthOutput, code: string) => {
  const a = out.airports.find((x) => x.airportCode === code);
  if (!a) throw new Error(`no ${code}`);
  return a;
};

describe("get_growth: the yearly series and trend facts (#67)", () => {
  it("get_growth([LAX]) returns the 10-year series of data/enplanements.json, in year order", async () => {
    const out = await growth(["LAX"]);
    expect(out.years).toEqual(YEARS);
    expect(enplanementsDataset.meta.years).toEqual(YEARS);
    const g = airport(out, "LAX").growth;
    expect(g.series.map((p) => p.year)).toEqual(YEARS);
    expect(g.series[0]).toEqual({ year: 2015, enplanements: 36_351_272 });
    expect(g.series[9]).toEqual({ year: 2024, enplanements: 37_760_834 });
    const record = enplanementsDataset.airports["LAX"]!;
    expect(g.series).toEqual(record.series.map((p) => ({ year: p.year, enplanements: p.enplanements })));
  });

  it("the trend facts: CAGRs (cagr10yr labelled 9 periods), recovery, latest + YoY, 2020 COVID low, peak", async () => {
    const g = airport(await growth(["LAX"]), "LAX").growth;
    expect(g).toMatchObject({
      cagr5yr: -2.5375,
      cagr10yr: 0.4236,
      cagr10yrPeriods: 9,
      recoveryVs2019: 0.8794,
      latest: { year: 2024, enplanements: 37_760_834, yoyChangePct: -7.803 },
      covid2020: { enplanements: 14_055_777 },
      peak: { year: 2019, enplanements: 42_939_104 },
    });
    // (14,055,777 ÷ 42,939,104 − 1) × 100, to 4 decimals like the dataset.
    expect(g.covid2020.pctVs2019).toBe(-67.2658);
    expect(getGrowthTool.description).toMatch(/9 periods/);
  });

  it("missing years stay null, never interpolated: 0AK has no CY2020 / CY2021 figure", async () => {
    const g = airport(await growth(["0ak"]), "0AK").growth;
    expect(g.series.map((p) => p.year)).toEqual(YEARS);
    expect(g.series.filter((p) => p.enplanements === null).map((p) => p.year)).toEqual([2020, 2021]);
    expect(g.covid2020).toEqual({ enplanements: null, pctVs2019: null });
  });

  it("for every airport in the dataset the non-null points are exactly its FAA rows (nothing invented)", () => {
    for (const record of Object.values(enplanementsDataset.airports)) {
      const g = growthFacts(record, enplanementsDataset.meta.years);
      expect(g.series).toHaveLength(10);
      const present = g.series.filter((p) => p.enplanements !== null);
      expect(present).toEqual(record.series.map((p) => ({ year: p.year, enplanements: p.enplanements })));
    }
  });

  it("validates like score_airports: codes upper-cased and deduped, unknown in notFound, max 5", async () => {
    const out = await growth(["den", " SFO ", "DEN", "ZZZ"]);
    expect(out.airports.map((a) => a.airportCode)).toEqual(["DEN", "SFO"]);
    expect(out.notFound).toEqual(["ZZZ"]);
    const six = await getGrowthTool.run({ airport_codes: ["LAX", "SNA", "ATL", "SFO", "JFK", "DEN"] }, ctx);
    expect(six.ok).toBe(false);
  });
});

describe("golden: get_growth's trend facts equal score_airports' growth evidence and get_enplanements (#67)", () => {
  const CODES = ["LAX", "DEN", "SFO", "BOS", "1G4"];

  it("cagr5yr == score_airports([code]) growth evidence; cagr10yr and recovery == get_enplanements", async () => {
    const out = await growth(CODES);
    for (const a of out.airports) {
      const s = await scoreAirportsTool.run({ airport_codes: [a.airportCode] }, ctx);
      if (!s.ok) throw new Error("score_airports failed");
      const score = s.output as unknown as { ranking: Array<{ breakdown: { growth: { evidence: { inputs: { cagr5yr: number | null }; value: number | null } } } }> };
      const ev = score.ranking[0]!.breakdown.growth.evidence;
      expect(a.growth.cagr5yr).toBe(ev.inputs.cagr5yr);
      expect(a.growth.cagr5yr).toBe(a.raw);
      const e = await getEnplanementsTool.run({ airport_code: a.airportCode }, ctx);
      if (!e.ok) throw new Error("get_enplanements failed");
      const enp = e.output as unknown as { trend: { cagr5yr: number | null; cagr10yr: number | null; recoveryVs2019: number | null } };
      expect(a.growth).toMatchObject(enp.trend);
    }
  });
});
