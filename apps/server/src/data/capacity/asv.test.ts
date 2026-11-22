import { describe, expect, it } from "vitest";
import {
  asvMidpoint,
  bestConfiguration,
  configurationOf,
  FIGURE_2_1_ASV,
  parallelConfigurations,
  RUNWAYS_IN_CONFIGURATION,
  spacingBand,
  twoOrientationConfigurations,
  type RunwayLayout,
} from "./asv.ts";

const layout = (groups: number[][], crossing = false): RunwayLayout => ({ parallelGroups: groups, crosses: () => crossing });
const best = (groups: number[][], crossing = false): number | null => bestConfiguration(layout(groups, crossing))?.figure21No ?? null;

describe("FAA AC 150/5060-5 Figure 2-1 table (#54)", () => {
  it("has the 19 configurations, five mix-index ASVs each, in the figure's order", () => {
    expect(FIGURE_2_1_ASV.map((r) => r.no)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    for (const row of FIGURE_2_1_ASV) expect(row.asvByMixIndex).toHaveLength(5);
    expect(Object.keys(RUNWAYS_IN_CONFIGURATION)).toHaveLength(19);
  });

  it("keeps the figure's values (spot rows read from the AC) and uses the row midpoint", () => {
    expect(FIGURE_2_1_ASV[0]!.asvByMixIndex).toEqual([230_000, 195_000, 205_000, 210_000, 240_000]); // no. 1, single
    expect(FIGURE_2_1_ASV[7]!.asvByMixIndex).toEqual([715_000, 550_000, 515_000, 565_000, 675_000]); // no. 8
    expect(FIGURE_2_1_ASV[8]!.asvByMixIndex).toEqual([230_000, 200_000, 215_000, 225_000, 265_000]); // no. 9
    expect(asvMidpoint(FIGURE_2_1_ASV[0]!)).toBe(217_500); // (195,000 + 240,000) / 2
    expect(configurationOf(2)).toEqual({
      figure21No: 2,
      label: "two parallel runways 700-2,499 ft apart",
      asvRange: [260_000, 355_000],
      asv: 307_500,
      runwaysUsed: 2,
    });
    expect(configurationOf(8).asv).toBe(615_000);
  });

  it("puts parallel spacing in the figure's bands (no PRM: 4,300 ft for far)", () => {
    expect(spacingBand(699)).toBeNull();
    expect(spacingBand(700)).toBe("close");
    expect(spacingBand(2_499)).toBe("close");
    expect(spacingBand(2_500)).toBe("intermediate");
    expect(spacingBand(4_299)).toBe("intermediate");
    expect(spacingBand(4_300)).toBe("far");
    expect(spacingBand(Number.NaN)).toBeNull();
  });
});

describe("runway layout -> Figure 2-1 configuration (#54)", () => {
  it("maps each parallel-only layout to its configuration (1-8)", () => {
    expect(best([[0]])).toBe(1);
    expect(best([[0, 1_000]])).toBe(2);
    expect(best([[0, 3_000]])).toBe(3);
    expect(best([[0, 5_000]])).toBe(4);
    expect(best([[0, 1_000, 2_000]])).toBe(5);
    expect(parallelConfigurations([0, 1_000, 2_000]).sort((a, b) => a - b)).toEqual([1, 2, 5]);
    expect(parallelConfigurations([0, 1_000, 4_000]).sort((a, b) => a - b)).toEqual([1, 2, 3, 6]);
    expect(best([[0, 1_000, 4_000]])).toBe(6);
    expect(best([[0, 1_000, 6_000]])).toBe(7);
    expect(best([[0, 1_000, 6_000, 7_000]])).toBe(8); // ATL/LAX shape: two close pairs, far apart
  });

  it("maps two orientations to the crossing (9-13) or open-V (14-19) rows", () => {
    expect(twoOrientationConfigurations([0], [0], true)).toEqual([9]);
    expect(best([[0], [0]], true)).toBe(9); // LGA: two intersecting runways
    expect(best([[0], [0]], false)).toBe(14); // open V: 14 (245,000) beats 15 (240,000)
    expect(best([[0, 1_000], [0]], false)).toBe(16);
    expect(best([[0, 1_000], [0, 1_000]], true)).toBe(13);
    expect(best([[0, 5_000], [0]], true)).toBe(4); // 12 ties 4 at 337,500: the lower number wins
  });

  it("takes the highest-ASV configuration the layout contains (AC paragraph 2-3.b)", () => {
    // Three close parallels contain no. 1, 2 (307,500) and 5 (335,000): no. 5 is chosen.
    expect(configurationOf(best([[0, 1_000, 2_000]])!).asv).toBe(335_000);
    // Three far parallels (CLT's shape): the figure has no such row, the best it contains is no. 4.
    expect(best([[0, 5_000, 10_000]])).toBe(4);
    // A crossing runway added to a close pair: no. 10 (307,500) ties no. 2; the lower number wins.
    expect(best([[0, 1_000], [0]], true)).toBe(2);
  });

  it("an unmapped layout (no runway at all) is null, never guessed", () => {
    expect(bestConfiguration(layout([]))).toBeNull();
    expect(parallelConfigurations([])).toEqual([]);
  });
});
