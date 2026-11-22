// Pure part of the capacity build: NASR runways per airport -> data/capacity.json. Unit-tested with fixtures.
import { bestConfiguration, configurationOf, extendLayout } from "./asv.ts";
import { summarizeLayout, type LocatedRunway } from "./layout.ts";
import type { NasrRunway } from "./nasr.ts";
import { CAPACITY_PROFILES_CITATION, CORE30_CAPACITY_PROFILES_2014, profileCapacity, type CapacityProfileRow } from "./profiles.ts";
import type { CapacityAirport, CapacityConfiguration, CapacityDataset, CapacityEstimate, CapacitySource } from "./types.ts";

export const NO_RUNWAY = "no land runway for this airport in FAA NASR (closed, renamed, or a seaplane base / heliport)";
export const NO_COORDINATES = "NASR has no end coordinates for one or more runways, so the layout cannot be placed";

const fmt = (n: number): string => n.toLocaleString("en-US");

/**
 * The ASV the congestion KPI uses, best source first: the FAA capacity profile (Core 30), else the extended
 * Figure 2-1 value when a parallel group goes beyond the figure and beats the matched configuration, else the
 * matched Figure 2-1 configuration. null when none applies.
 */
export function chooseCapacity(
  profile: CapacityProfileRow | undefined,
  configuration: CapacityConfiguration | null,
  parallelGroups: readonly (readonly number[])[],
): CapacityEstimate | null {
  if (profile !== undefined) {
    const p = profileCapacity(profile);
    return {
      source: "faa-capacity-profile",
      asv: p.asv,
      basis:
        `${CAPACITY_PROFILES_CITATION}: ${p.visualPerHour} visual and ${p.instrumentPerHour} instrument operations an hour ` +
        `(range midpoints), weighted 90/10 = ${p.weightedPerHour}/h, × ${fmt(p.demandFactor)} (AC 150/5060-5 Table 2-1 D × H)`,
      profile: {
        visualPerHour: p.visualPerHour,
        instrumentPerHour: p.instrumentPerHour,
        weightedPerHour: p.weightedPerHour,
        demandFactor: p.demandFactor,
      },
    };
  }
  if (configuration === null) return null;
  const ext = extendLayout(parallelGroups);
  if (ext !== null && ext.asv > configuration.asv) {
    const added = [
      ext.addedPairs > 0 ? `${ext.addedPairs} independent pair(s)` : "",
      ext.addedSingles > 0 ? `${ext.addedSingles} independent runway(s)` : "",
    ]
      .filter((s) => s !== "")
      .join(" and ");
    const how =
      added === ""
        ? `configuration ${ext.baseFigure21No}, with the intermediate pair counted as a close pair`
        : `configuration ${ext.baseFigure21No} plus ${added}, at the increments the figure shows`;
    return {
      source: "figure-2-1-extended",
      asv: ext.asv,
      basis: `extension of AC 150/5060-5 Figure 2-1 (not an FAA figure): ${how}`,
      extension: { baseFigure21No: ext.baseFigure21No, addedPairs: ext.addedPairs, addedSingles: ext.addedSingles },
    };
  }
  return {
    source: "figure-2-1",
    asv: configuration.asv,
    basis: `AC 150/5060-5 Figure 2-1 configuration ${configuration.figure21No} (${configuration.label}), row midpoint`,
  };
}

/** One airport's record: its runways, layout, Figure 2-1 configuration and the ASV used, or a reason it is missing. */
export function assembleAirport(code: string, runways: readonly NasrRunway[]): CapacityAirport {
  const profile = CORE30_CAPACITY_PROFILES_2014[code];
  const kept = runways.map(({ id, lengthFt, surface }) => ({ id, lengthFt, surface }));
  const base = { code, runways: kept, parallelSpacingsFt: [], crossing: null };
  const missing = (layoutRunways: number, missingReason: string): CapacityAirport => ({
    ...base,
    layoutRunways,
    configuration: null,
    capacity: chooseCapacity(profile, null, []),
    missingReason,
  });
  if (runways.length === 0) return missing(0, NO_RUNWAY);
  // One runway is configuration 1 whatever its position, so it needs no coordinates.
  if (runways.length === 1) {
    const configuration = configurationOf(1);
    return { ...base, layoutRunways: 1, configuration, capacity: chooseCapacity(profile, configuration, []) };
  }
  if (runways.some((r) => r.ends === null)) return missing(runways.length, NO_COORDINATES);
  const summary = summarizeLayout(runways as readonly LocatedRunway[]);
  const configuration = bestConfiguration(summary.layout);
  return {
    code,
    runways: kept,
    parallelSpacingsFt: summary.parallelSpacingsFt,
    layoutRunways: summary.layout.parallelGroups.reduce((n, g) => n + g.length, 0),
    crossing: summary.crossing,
    configuration,
    capacity: chooseCapacity(profile, configuration, summary.layout.parallelGroups),
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
  const count = (s: CapacitySource): number => values.filter((a) => a.capacity?.source === s).length;
  return {
    meta: {
      source: `FAA NASR 28-day subscription, APT_RWY.csv + APT_RWY_END.csv (nfdc.faa.gov); ${CAPACITY_PROFILES_CITATION}`,
      nasrCycle,
      method:
        "ASV used (capacity): Core 30 airports = FAA Airport Capacity Profiles 2014 hourly rates × AC 150/5060-5 para 3-6 (ASV = Cw × D × H); " +
        "else FAA AC 150/5060-5 Chg 2, Figure 2-1: highest-ASV runway-use configuration the layout contains, ASV = midpoint of its row, " +
        "extended by the figure's own increments for 3+ independent parallel streams (not an FAA figure)",
      airportCount: values.length,
      mappedCount: values.filter((a) => a.configuration !== null).length,
      capacitySources: {
        "faa-capacity-profile": count("faa-capacity-profile"),
        "figure-2-1-extended": count("figure-2-1-extended"),
        "figure-2-1": count("figure-2-1"),
      },
    },
    airports,
  };
}

/** The JSON text written to data/capacity.json. */
export function serializeCapacity(dataset: CapacityDataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`;
}
