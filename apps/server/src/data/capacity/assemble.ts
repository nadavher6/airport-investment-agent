// Pure part of the capacity build: NASR runways per airport -> data/capacity.json. Unit-tested with fixtures.
import { bestConfiguration, configurationOf } from "./asv.ts";
import { summarizeLayout, type LocatedRunway } from "./layout.ts";
import type { NasrRunway } from "./nasr.ts";
import type { CapacityAirport, CapacityDataset } from "./types.ts";

export const NO_RUNWAY = "no land runway for this airport in FAA NASR (closed, renamed, or a seaplane base / heliport)";
export const NO_COORDINATES = "NASR has no end coordinates for one or more runways, so the layout cannot be placed";

/** One airport's record: its runways, layout and Figure 2-1 configuration, or a reason it is missing. */
export function assembleAirport(code: string, runways: readonly NasrRunway[]): CapacityAirport {
  const kept = runways.map(({ id, lengthFt, surface }) => ({ id, lengthFt, surface }));
  const base = { code, runways: kept, parallelSpacingsFt: [], crossing: null };
  if (runways.length === 0) return { ...base, layoutRunways: 0, configuration: null, missingReason: NO_RUNWAY };
  // One runway is configuration 1 whatever its position, so it needs no coordinates.
  if (runways.length === 1) return { ...base, layoutRunways: 1, configuration: configurationOf(1) };
  if (runways.some((r) => r.ends === null)) {
    return { ...base, layoutRunways: runways.length, configuration: null, missingReason: NO_COORDINATES };
  }
  const summary = summarizeLayout(runways as readonly LocatedRunway[]);
  const configuration = bestConfiguration(summary.layout);
  return {
    code,
    runways: kept,
    parallelSpacingsFt: summary.parallelSpacingsFt,
    layoutRunways: summary.layout.parallelGroups.reduce((n, g) => n + g.length, 0),
    crossing: summary.crossing,
    configuration,
    ...(configuration === null ? { missingReason: NO_RUNWAY } : {}),
  };
}

const byCode = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** The whole dataset for the given airport codes, sorted by code (so two builds give the same file). */
export function assembleCapacity(
  codes: readonly string[],
  runways: ReadonlyMap<string, readonly NasrRunway[]>,
  nasrCycle: string,
): CapacityDataset {
  const airports: Record<string, CapacityAirport> = {};
  for (const code of [...new Set(codes)].sort(byCode)) airports[code] = assembleAirport(code, runways.get(code) ?? []);
  const values = Object.values(airports);
  return {
    meta: {
      source: "FAA NASR 28-day subscription, APT_RWY.csv + APT_RWY_END.csv (nfdc.faa.gov)",
      nasrCycle,
      method: "FAA AC 150/5060-5 Chg 2, Figure 2-1: highest-ASV runway-use configuration the layout contains; ASV = midpoint of its row",
      airportCount: values.length,
      mappedCount: values.filter((a) => a.configuration !== null).length,
    },
    airports,
  };
}

/** The JSON text written to data/capacity.json. */
export function serializeCapacity(dataset: CapacityDataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}
