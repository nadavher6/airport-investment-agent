import { describe, expect, it } from "vitest";
import { chooseCapacity } from "./assemble.ts";
import { configurationOf } from "./asv.ts";
import { cellRate, CORE30_CAPACITY_PROFILES_2014, CORE_DEMAND_FACTOR, IFR_SHARE, profileCapacity } from "./profiles.ts";

const CORE30 = "ATL BOS BWI CLT DCA DEN DFW DTW EWR FLL HNL IAD IAH JFK LAS LAX LGA MCO MDW MEM MIA MSP ORD PHL PHX SAN SEA SFO SLC TPA";

describe("FAA Airport Capacity Profiles 2014, Table 1 (Core 30)", () => {
  it("has exactly the 30 Core airports of the report", () => {
    expect(Object.keys(CORE30_CAPACITY_PROFILES_2014).sort().join(" ")).toBe(CORE30);
  });

  it("pins transcribed cells (visual / marginal / instrument, ops per hour)", () => {
    expect(CORE30_CAPACITY_PROFILES_2014.LGA).toEqual({ visual: [80, 86], marginal: [76, 77], instrument: [74, 76] });
    expect(CORE30_CAPACITY_PROFILES_2014.ORD).toEqual({ visual: [214, 225], marginal: [194, 200], instrument: [168, 178] });
    expect(CORE30_CAPACITY_PROFILES_2014.DEN!.visual).toEqual({ ap: [262, 266], dp: [266, 298] });
    expect(CORE30_CAPACITY_PROFILES_2014.SAN!.instrument).toEqual([48, 48]);
  });

  it("a cell's rate is its range midpoint; with AP and DP, the higher midpoint", () => {
    expect(cellRate([80, 86])).toBe(83);
    expect(cellRate({ ap: [262, 266], dp: [266, 298] })).toBe(282);
    expect(cellRate({ ap: [175, 190], dp: [183, 186] })).toBe(184.5);
  });

  it("annualizes by AC 150/5060-5 para 3-6: ASV = (90% visual + 10% instrument) × D × H", () => {
    expect(IFR_SHARE).toBe(0.1);
    expect(CORE_DEMAND_FACTOR).toBe(4_370); // (320 × 12 + 350 × 14) ÷ 2, AC Table 2-1
    expect(profileCapacity(CORE30_CAPACITY_PROFILES_2014.LGA!)).toEqual({
      visualPerHour: 83,
      instrumentPerHour: 75,
      weightedPerHour: 82.2,
      demandFactor: 4_370,
      asv: 359_200, // 82.2 × 4,370 = 359,214 -> nearest 100
    });
    expect(profileCapacity(CORE30_CAPACITY_PROFILES_2014.ATL!).asv).toBe(949_800);
    expect(profileCapacity(CORE30_CAPACITY_PROFILES_2014.DEN!).asv).toBe(1_211_100);
  });

  it("the published capacity is used when present, over Figure 2-1 and its extension", () => {
    const fig8 = configurationOf(8);
    expect(chooseCapacity(CORE30_CAPACITY_PROFILES_2014.ATL, fig8, [[0, 4_210, 5_262, 9_671, 10_674]])?.source).toBe(
      "faa-capacity-profile",
    );
    expect(chooseCapacity(undefined, fig8, [[0, 1_000, 6_000, 7_000]])).toMatchObject({ source: "figure-2-1", asv: 615_000 });
    expect(chooseCapacity(undefined, null, [])).toBeNull();
  });
});
