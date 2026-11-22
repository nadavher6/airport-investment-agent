/**
 * Published runway capacity for the FAA's 30 Core airports, and how it is turned into an annual service volume.
 *
 * Source: FAA Office of Airports, "Airport Capacity Profiles" (prepared by MITRE CAASD, report date May 2014,
 * cover date July 2014), Table 1 "Capacity Rate Ranges for Current Operations at the Core Airports", report page 9
 * (PDF page 12). https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/profiles/Airport-Capacity-Profiles-2014.pdf
 * (SHA-256 and download date in data/raw/SOURCES.md). Every number below is that table's cell for the airport, in
 * aircraft operations (arrivals + departures) per hour, as "low-high": the range between the ATC Facility Reported
 * ("called") rate and the model-estimated rate (report pages 1 and 3). Cells with two values are the arrival-priority
 * (AP) and departure-priority (DP) configurations. ATL's fourth condition (Low Instrument) is not used.
 *
 * Annualization (documented in DESIGN.md §1 "Runway capacity (ASV)"): FAA AC 150/5060-5 paragraph 3-6 defines
 * ASV = Cw × D × H, with Cw the weighted hourly capacity, D = annual ÷ average-day demand and H = average-day ÷
 * average-peak-hour demand (peak month). Here:
 * - each cell's value is the midpoint of its range; with AP and DP, the higher midpoint (the profile and AC
 *   paragraph 2-3.b both take the highest-capacity configuration);
 * - Cw = 90% visual + 10% instrument, the AC's own Figure 2-1 assumption that IFR weather occurs roughly 10% of the
 *   time (paragraph 2-3.a). The marginal column is not used (no free per-airport weather split was used);
 * - D × H = the midpoint of AC Table 2-1's demand ratios for mix index 81-120 (D 320, H 12) and 121-180 (D 350,
 *   H 14), because a Core airport's traffic is mostly class C and D aircraft (mix index above 80) and the exact
 *   mix index needs fleet-mix data no free source tabulates. This is an assumption, stated as such.
 * Pure: no I/O.
 */

/** One Table 1 cell: [low, high] operations per hour, or two ranges (AP and DP configurations). */
export type RateCell = readonly [number, number] | { readonly ap: readonly [number, number]; readonly dp: readonly [number, number] };

export interface CapacityProfileRow {
  readonly visual: RateCell;
  readonly marginal: RateCell;
  readonly instrument: RateCell;
}

/** Report and table the values come from, cited on every row of the dataset. */
export const CAPACITY_PROFILES_CITATION =
  "FAA Airport Capacity Profiles (May 2014), Table 1 \"Capacity Rate Ranges for Current Operations at the Core Airports\", p. 9";

const r = (low: number, high: number = low): readonly [number, number] => [low, high];

/** FAA Airport Capacity Profiles 2014, Table 1 (p. 9): operations per hour, visual / marginal / instrument. */
export const CORE30_CAPACITY_PROFILES_2014: Readonly<Record<string, CapacityProfileRow>> = {
  ATL: { visual: { ap: r(216, 226), dp: r(219, 222) }, marginal: { ap: r(201, 208), dp: r(206) }, instrument: { ap: r(175, 190), dp: r(183, 186) } },
  BOS: { visual: r(116, 125), marginal: r(109, 112), instrument: r(84, 86) },
  BWI: { visual: r(68, 80), marginal: r(64, 80), instrument: r(62, 64) },
  CLT: { visual: r(176, 182), marginal: r(161, 162), instrument: r(138, 147) },
  DCA: { visual: r(69, 72), marginal: r(69, 72), instrument: r(54, 64) },
  DEN: { visual: { ap: r(262, 266), dp: r(266, 298) }, marginal: r(224, 279), instrument: r(224, 243) },
  DFW: { visual: r(226, 264), marginal: r(194, 245), instrument: r(170) },
  DTW: { visual: r(178, 184), marginal: r(163, 164), instrument: r(136) },
  EWR: { visual: { ap: r(94, 99), dp: r(94, 100) }, marginal: r(76, 84), instrument: r(68, 70) },
  FLL: { visual: r(74, 82), marginal: r(66, 72), instrument: r(56, 66) },
  HNL: { visual: r(117, 120), marginal: r(91, 105), instrument: r(60, 77) },
  IAD: { visual: { ap: r(150, 159), dp: r(156, 164) }, marginal: { ap: r(112, 120), dp: r(136, 145) }, instrument: { ap: r(108, 111), dp: r(125, 132) } },
  IAH: { visual: r(172, 199), marginal: r(152, 180), instrument: r(144, 151) },
  JFK: { visual: { ap: r(84, 87), dp: r(90, 93) }, marginal: r(85, 86), instrument: r(74, 84) },
  LAS: { visual: r(122, 128), marginal: r(106, 111), instrument: r(78, 83) },
  LAX: { visual: r(167, 176), marginal: r(147, 153), instrument: r(133, 143) },
  LGA: { visual: r(80, 86), marginal: r(76, 77), instrument: r(74, 76) },
  MCO: { visual: r(160, 171), marginal: r(148, 161), instrument: r(144) },
  MDW: { visual: r(64, 84), marginal: r(64, 74), instrument: r(52, 70) },
  MEM: { visual: r(144, 160), marginal: r(133, 150), instrument: r(111, 134) },
  MIA: { visual: r(132, 150), marginal: r(132, 148), instrument: r(100, 104) },
  MSP: { visual: r(156, 167), marginal: r(142, 151), instrument: r(114, 141) },
  ORD: { visual: r(214, 225), marginal: r(194, 200), instrument: r(168, 178) },
  PHL: { visual: r(120, 126), marginal: r(94, 96), instrument: r(84, 88) },
  PHX: { visual: r(138, 145), marginal: r(108, 109), instrument: r(96, 101) },
  SAN: { visual: r(48, 57), marginal: r(48, 52), instrument: r(48) },
  SEA: { visual: r(100, 112), marginal: r(86, 100), instrument: r(76, 78) },
  SFO: { visual: r(100, 110), marginal: r(90, 93), instrument: r(70, 72) },
  SLC: { visual: r(148, 150), marginal: r(138, 140), instrument: r(114, 120) },
  TPA: { visual: r(113, 115), marginal: r(95, 115), instrument: r(90, 95) },
};

/** AC 150/5060-5 paragraph 2-3.a: IFR weather occurs roughly 10% of the time (the Figure 2-1 ASV assumption). */
export const IFR_SHARE = 0.1;

/** AC 150/5060-5 Table 2-1 demand ratios (D, H) for mix index 81-120 and 121-180. */
export const TABLE_2_1_DEMAND_RATIOS = {
  mix81to120: { daily: 320, hourly: 12 },
  mix121to180: { daily: 350, hourly: 14 },
} as const;

/** D × H used for the Core airports: midpoint of the two upper mix-index rows, (3,840 + 4,900) ÷ 2 = 4,370. */
export const CORE_DEMAND_FACTOR =
  (TABLE_2_1_DEMAND_RATIOS.mix81to120.daily * TABLE_2_1_DEMAND_RATIOS.mix81to120.hourly +
    TABLE_2_1_DEMAND_RATIOS.mix121to180.daily * TABLE_2_1_DEMAND_RATIOS.mix121to180.hourly) /
  2;

const mid = ([low, high]: readonly [number, number]): number => (low + high) / 2;

/** A cell's hourly rate: the midpoint of its range; with AP and DP, the higher of the two midpoints. */
export function cellRate(cell: RateCell): number {
  return "ap" in cell ? Math.max(mid(cell.ap), mid(cell.dp)) : mid(cell);
}

export interface ProfileCapacity {
  readonly visualPerHour: number;
  readonly instrumentPerHour: number;
  /** Cw = 90% visual + 10% instrument, operations per hour, one decimal. */
  readonly weightedPerHour: number;
  /** D × H. */
  readonly demandFactor: number;
  /** ASV = Cw × D × H, rounded to the nearest 100 operations a year. */
  readonly asv: number;
}

/** The annual service volume from a profile row, by the method above. */
export function profileCapacity(row: CapacityProfileRow): ProfileCapacity {
  const visualPerHour = cellRate(row.visual);
  const instrumentPerHour = cellRate(row.instrument);
  const weighted = (1 - IFR_SHARE) * visualPerHour + IFR_SHARE * instrumentPerHour;
  return {
    visualPerHour,
    instrumentPerHour,
    weightedPerHour: Math.round(weighted * 10) / 10,
    demandFactor: CORE_DEMAND_FACTOR,
    asv: Math.round((weighted * CORE_DEMAND_FACTOR) / 100) * 100,
  };
}
