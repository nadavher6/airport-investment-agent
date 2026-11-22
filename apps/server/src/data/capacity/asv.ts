/**
 * Annual Service Volume (ASV) by runway-use configuration, from FAA Advisory Circular AC 150/5060-5
 * "Airport Capacity and Delay" (Change 2, 1995-12-01), Chapter 2 "Capacity and delay calculations for
 * long range planning", Figure 2-1 "Capacity and ASV for long range planning" (AC pages 8-11).
 * Source PDF: https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5060_5.pdf
 *
 * Each row of Figure 2-1 gives the ASV (operations per year) for five mix-index bands, %(C+3D):
 * 0-20, 21-50, 51-80, 81-120, 121-180. The mix index needs the airport's fleet mix, which no free source
 * tabulates, so the ASV used is the midpoint of the row's lowest and highest value (as issue #54 asks).
 *
 * Spacing bands are the figure's own: 700-2,499 ft ("close"), 2,500-4,299 ft ("intermediate") and
 * 4,300 ft or more ("far"). The figure also allows 3,400 ft instead of 4,300 ft where Precision Runway
 * Monitor radar is installed (paragraph 2-2.f); NASR does not record PRM, so the 4,300 ft line is used.
 * Pure: no I/O. The geometry that feeds it is in layout.ts.
 */
import type { CapacityConfiguration } from "./types.ts";

/** One row of Figure 2-1: configuration number, plain name, ASV for the five mix-index bands. */
export interface Figure21Row {
  readonly no: number;
  readonly label: string;
  readonly asvByMixIndex: readonly [number, number, number, number, number];
}

/** AC 150/5060-5 Figure 2-1, ASV column (ops/yr), mix index 0-20, 21-50, 51-80, 81-120, 121-180. */
export const FIGURE_2_1_ASV: readonly Figure21Row[] = [
  { no: 1, label: "single runway", asvByMixIndex: [230_000, 195_000, 205_000, 210_000, 240_000] },
  { no: 2, label: "two parallel runways 700-2,499 ft apart", asvByMixIndex: [355_000, 275_000, 260_000, 285_000, 340_000] },
  { no: 3, label: "two parallel runways 2,500-4,299 ft apart", asvByMixIndex: [355_000, 285_000, 275_000, 300_000, 365_000] },
  { no: 4, label: "two parallel runways 4,300 ft or more apart", asvByMixIndex: [370_000, 320_000, 305_000, 315_000, 370_000] },
  { no: 5, label: "three parallel runways, both gaps 700-2,499 ft", asvByMixIndex: [385_000, 305_000, 285_000, 310_000, 375_000] },
  { no: 6, label: "three parallel runways, gaps 700-2,499 ft and 2,500-4,299 ft", asvByMixIndex: [385_000, 310_000, 290_000, 315_000, 385_000] },
  { no: 7, label: "three parallel runways, gaps 700-2,499 ft and 4,300 ft or more", asvByMixIndex: [625_000, 475_000, 455_000, 510_000, 645_000] },
  { no: 8, label: "four parallel runways: two close pairs (700-2,499 ft) 4,300 ft or more apart", asvByMixIndex: [715_000, 550_000, 515_000, 565_000, 675_000] },
  { no: 9, label: "two intersecting runways", asvByMixIndex: [230_000, 200_000, 215_000, 225_000, 265_000] },
  { no: 10, label: "close parallel pair (700-2,499 ft) crossed by a third runway", asvByMixIndex: [355_000, 275_000, 260_000, 285_000, 340_000] },
  { no: 11, label: "intermediate parallel pair (2,500-4,299 ft) crossed by a third runway", asvByMixIndex: [355_000, 285_000, 275_000, 300_000, 365_000] },
  { no: 12, label: "far parallel pair (4,300 ft or more) crossed by a third runway", asvByMixIndex: [370_000, 320_000, 305_000, 315_000, 370_000] },
  { no: 13, label: "two close parallel pairs crossing each other", asvByMixIndex: [355_000, 275_000, 270_000, 295_000, 350_000] },
  { no: 14, label: "two non-intersecting divergent runways (open V), operations away from the V", asvByMixIndex: [270_000, 225_000, 220_000, 225_000, 265_000] },
  { no: 15, label: "two non-intersecting divergent runways (open V), operations toward the V", asvByMixIndex: [260_000, 220_000, 215_000, 225_000, 265_000] },
  { no: 16, label: "close parallel pair and a divergent runway (open V), operations away", asvByMixIndex: [385_000, 305_000, 275_000, 300_000, 355_000] },
  { no: 17, label: "close parallel pair and a divergent runway (open V), operations toward", asvByMixIndex: [355_000, 275_000, 260_000, 285_000, 340_000] },
  { no: 18, label: "two close parallel pairs, divergent (open V), operations away", asvByMixIndex: [385_000, 305_000, 275_000, 300_000, 355_000] },
  { no: 19, label: "two close parallel pairs, divergent (open V), operations toward", asvByMixIndex: [375_000, 295_000, 275_000, 300_000, 355_000] },
];

/** How many runways each Figure 2-1 configuration draws (configurations 1-19, as in the figure's sketches). */
export const RUNWAYS_IN_CONFIGURATION: Readonly<Record<number, number>> = {
  1: 1, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 4, 9: 2, 10: 3,
  11: 3, 12: 3, 13: 4, 14: 2, 15: 2, 16: 3, 17: 3, 18: 4, 19: 4,
};

/** Figure 2-1 spacing bands for parallel runways (ft). Under 700 ft, two runways count as one. */
export const MIN_PARALLEL_SPACING_FT = 700;
export const INTERMEDIATE_SPACING_FT = 2_500;
export const FAR_SPACING_FT = 4_300;

export type SpacingBand = "close" | "intermediate" | "far";

/** The Figure 2-1 band of a centerline spacing, or null under 700 ft (not two usable parallels). */
export function spacingBand(ft: number): SpacingBand | null {
  if (!(ft >= MIN_PARALLEL_SPACING_FT)) return null;
  if (ft < INTERMEDIATE_SPACING_FT) return "close";
  return ft < FAR_SPACING_FT ? "intermediate" : "far";
}

/**
 * The airport's runway layout, reduced to what Figure 2-1 distinguishes: groups of parallel runways
 * (each given by the sorted centerline offsets of its runways, ft, after merging runways under 700 ft
 * apart) and, for each pair of groups, whether their runways cross.
 */
export interface RunwayLayout {
  readonly parallelGroups: readonly (readonly number[])[];
  /** crosses(i, j) for group indexes i < j: true when a runway of group i intersects one of group j. */
  readonly crosses: (i: number, j: number) => boolean;
}

/** Bands of the gaps between consecutive chosen runways, for every way of choosing k runways of a group. */
function gapBandsOfSubsets(offsets: readonly number[], k: number): (SpacingBand | null)[][] {
  const out: (SpacingBand | null)[][] = [];
  const pick = (start: number, chosen: number[]): void => {
    if (chosen.length === k) {
      out.push(chosen.slice(1).map((o, i) => spacingBand(o - (chosen[i] as number))));
      return;
    }
    for (let i = start; i < offsets.length; i++) pick(i + 1, [...chosen, offsets[i] as number]);
  };
  pick(0, []);
  return out;
}

const same = (a: readonly (SpacingBand | null)[], b: readonly SpacingBand[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);
const sameEitherWay = (a: readonly (SpacingBand | null)[], b: readonly SpacingBand[]): boolean =>
  same(a, b) || same(a, [...b].reverse());

/** Figure 2-1 configurations 1-8 that one parallel group contains (as a subset of its runways). */
export function parallelConfigurations(offsets: readonly number[]): number[] {
  if (offsets.length === 0) return [];
  const found = new Set<number>([1]);
  for (const [band] of gapBandsOfSubsets(offsets, 2)) {
    if (band === "close") found.add(2);
    if (band === "intermediate") found.add(3);
    if (band === "far") found.add(4);
  }
  for (const gaps of gapBandsOfSubsets(offsets, 3)) {
    if (same(gaps, ["close", "close"])) found.add(5);
    if (sameEitherWay(gaps, ["close", "intermediate"])) found.add(6);
    if (sameEitherWay(gaps, ["close", "far"])) found.add(7);
  }
  for (const gaps of gapBandsOfSubsets(offsets, 4)) {
    if (same(gaps, ["close", "far", "close"])) found.add(8);
  }
  return [...found];
}

const hasPair = (offsets: readonly number[], band: SpacingBand): boolean =>
  gapBandsOfSubsets(offsets, 2).some(([b]) => b === band);

/** Figure 2-1 configurations 9-19 that two non-parallel groups contain together. */
export function twoOrientationConfigurations(a: readonly number[], b: readonly number[], crossing: boolean): number[] {
  if (a.length === 0 || b.length === 0) return [];
  const closeA = hasPair(a, "close");
  const closeB = hasPair(b, "close");
  const found: number[] = [];
  if (crossing) {
    found.push(9);
    if (closeA || closeB) found.push(10);
    if (hasPair(a, "intermediate") || hasPair(b, "intermediate")) found.push(11);
    if (hasPair(a, "far") || hasPair(b, "far")) found.push(12);
    if (closeA && closeB) found.push(13);
  } else {
    found.push(14, 15);
    if (closeA || closeB) found.push(16, 17);
    if (closeA && closeB) found.push(18, 19);
  }
  return found;
}

/** Midpoint of a Figure 2-1 row: (lowest + highest ASV) / 2, operations per year. */
export function asvMidpoint(row: Figure21Row): number {
  return (Math.min(...row.asvByMixIndex) + Math.max(...row.asvByMixIndex)) / 2;
}

function rowOf(no: number): Figure21Row {
  const row = FIGURE_2_1_ASV.find((r) => r.no === no);
  if (row === undefined) throw new Error(`no Figure 2-1 configuration ${no}`);
  return row;
}

/** The configuration record for one Figure 2-1 row (midpoint ASV). */
export function configurationOf(no: number): CapacityConfiguration {
  const row = rowOf(no);
  return {
    figure21No: row.no,
    label: row.label,
    asvRange: [Math.min(...row.asvByMixIndex), Math.max(...row.asvByMixIndex)],
    asv: asvMidpoint(row),
    runwaysUsed: RUNWAYS_IN_CONFIGURATION[row.no] ?? 0,
  };
}

/**
 * The Figure 2-1 configuration for a layout: of every configuration the layout contains, the one with the
 * highest midpoint ASV (lowest number on a tie). The AC assumes the airport runs its highest-capacity
 * runway-use configuration (paragraph 2-3.b: "roughly 80 percent of the time the airport is operated with
 * the runway-use configuration which produces the greatest hourly capacity"), and paragraph 2-2.a says any
 * layout can be approximated by one of the 19. null when the layout has no runway.
 */
export function bestConfiguration(layout: RunwayLayout): CapacityConfiguration | null {
  const candidates = new Set<number>();
  const groups = layout.parallelGroups;
  groups.forEach((g) => parallelConfigurations(g).forEach((no) => candidates.add(no)));
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      twoOrientationConfigurations(groups[i] as number[], groups[j] as number[], layout.crosses(i, j)).forEach((no) =>
        candidates.add(no),
      );
    }
  }
  if (candidates.size === 0) return null;
  const best = [...candidates]
    .map(configurationOf)
    .sort((x, y) => y.asv - x.asv || x.figure21No - y.figure21No)[0];
  return best ?? null;
}

/*
 * Extension beyond Figure 2-1 (this project's rule, NOT an FAA figure). Figure 2-1 draws at most two independent
 * parallel streams (runways 4,300 ft or more apart), configurations 4, 7 and 8, and only with close pairs (700-2,499
 * ft). The extension covers what it does not draw:
 * - two streams where a pair is intermediate (2,500-4,299 ft): valued as configuration 7 or 8, since the figure
 *   values an intermediate pair (configuration 3) at least as high as a close pair (configuration 2);
 * - three or more streams: the two strongest are configuration 4, 7 or 8, and each further stream adds the
 *   increment the figure itself shows for adding an independent stream:
 * - an independent pair adds configuration 8 − configuration 2 (two close pairs vs. one): 615,000 − 307,500 = 307,500
 *   (in every mix-index band configuration 8 is within 1% of twice configuration 2);
 * - an independent single runway adds configuration 4 − configuration 1 (two far singles vs. one): 337,500 − 217,500
 *   = 120,000, the smallest increment the figure shows for one more runway.
 * A stream is a run of runways whose neighbours are under 4,300 ft apart; a stream of 2+ runways counts as a close
 * pair (an intermediate pair is worth more in the figure, so this errs low). Extra orientations add nothing: AC
 * paragraph 2-4.b uses only the two most-used orientations. The extension is used only when it beats the matched
 * Figure 2-1 configuration (so a layout the figure draws keeps the figure's value).
 */

/** Sizes of the independent streams of one parallel group: its sorted offsets split at gaps of 4,300 ft or more. */
export function independentStreams(offsets: readonly number[]): number[] {
  if (offsets.length === 0) return [];
  const sizes = [1];
  for (let i = 1; i < offsets.length; i++) {
    if ((offsets[i] as number) - (offsets[i - 1] as number) >= FAR_SPACING_FT) sizes.push(1);
    else sizes[sizes.length - 1] = (sizes[sizes.length - 1] as number) + 1;
  }
  return sizes;
}

/** The ASV an extra independent pair adds (configuration 8 − configuration 2). */
export const INDEPENDENT_PAIR_INCREMENT = asvMidpoint(rowOf(8)) - asvMidpoint(rowOf(2));
/** The ASV an extra independent single runway adds (configuration 4 − configuration 1). */
export const INDEPENDENT_SINGLE_INCREMENT = asvMidpoint(rowOf(4)) - asvMidpoint(rowOf(1));

export interface ParallelExtension {
  /** The Figure 2-1 configuration (4, 7 or 8) that covers the two strongest streams. */
  readonly baseFigure21No: number;
  readonly addedPairs: number;
  readonly addedSingles: number;
  /** Base midpoint ASV + the increments, operations per year. */
  readonly asv: number;
}

/** The extended ASV of one parallel group, or null with fewer than two independent streams (nothing to extend). */
export function extendParallelGroup(offsets: readonly number[]): ParallelExtension | null {
  const streams = independentStreams(offsets);
  if (streams.length < 2) return null;
  const pairs = streams.filter((n) => n >= 2).length;
  const singles = streams.length - pairs;
  const [baseFigure21No, addedPairs, addedSingles] =
    pairs >= 2 ? [8, pairs - 2, singles] : pairs === 1 ? [7, 0, singles - 1] : [4, 0, singles - 2];
  const asv =
    asvMidpoint(rowOf(baseFigure21No)) + addedPairs * INDEPENDENT_PAIR_INCREMENT + addedSingles * INDEPENDENT_SINGLE_INCREMENT;
  return { baseFigure21No, addedPairs, addedSingles, asv };
}

/** The best extension over a layout's parallel groups, or null when no group goes beyond Figure 2-1. */
export function extendLayout(parallelGroups: readonly (readonly number[])[]): ParallelExtension | null {
  const found = parallelGroups.map(extendParallelGroup).filter((e): e is ParallelExtension => e !== null);
  return found.sort((x, y) => y.asv - x.asv)[0] ?? null;
}
