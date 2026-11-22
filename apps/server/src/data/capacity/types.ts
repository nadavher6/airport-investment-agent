// Shape of data/capacity.json, built from the FAA NASR runway records by src/data/capacity/build.ts.
// Server-internal: nothing here is part of the wire contract.

/** One runway kept from NASR (paved, not a helipad), as written to data/capacity.json. */
export interface CapacityRunway {
  /** NASR runway ID, e.g. "09L/27R". */
  readonly id: string;
  readonly lengthFt: number;
  /** NASR surface code, e.g. "CONC" or "ASPH-CONC". */
  readonly surface: string;
}

/** The FAA AC 150/5060-5 Figure 2-1 runway-use configuration chosen for an airport, and its ASV. */
export interface CapacityConfiguration {
  /** Configuration number in Figure 2-1 (1-19). */
  readonly figure21No: number;
  /** Plain-English name of the configuration, e.g. "two parallel runways 700-2,499 ft apart". */
  readonly label: string;
  /** Lowest and highest ASV in the figure's row for this configuration (operations per year). */
  readonly asvRange: readonly [number, number];
  /** The ASV used: the midpoint of asvRange (the mix index is unknown), operations per year. */
  readonly asv: number;
  /** Runways the configuration's sketch has. Fewer than the airport's layoutRunways means the ASV is understated. */
  readonly runwaysUsed: number;
}

/** Where the ASV used for utilization comes from, best first. */
export type CapacitySource =
  /** FAA Airport Capacity Profiles 2014 (Core 30), hourly rates annualized by AC 150/5060-5 paragraph 3-6. */
  | "faa-capacity-profile"
  /** This project's extension of Figure 2-1 for layouts with 3+ independent parallel streams (not an FAA figure). */
  | "figure-2-1-extended"
  /** AC 150/5060-5 Figure 2-1, the matched configuration's midpoint. */
  | "figure-2-1";

/** The ASV used for an airport, its source and how it was derived. */
export interface CapacityEstimate {
  readonly source: CapacitySource;
  /** Annual service volume used, operations per year. */
  readonly asv: number;
  /** One plain-English line: the source and the derivation. */
  readonly basis: string;
  /** faa-capacity-profile only: the profile's hourly rates and the annualization. */
  readonly profile?: {
    readonly visualPerHour: number;
    readonly instrumentPerHour: number;
    readonly weightedPerHour: number;
    readonly demandFactor: number;
  };
  /** figure-2-1-extended only: the Figure 2-1 base and the streams added to it. */
  readonly extension?: { readonly baseFigure21No: number; readonly addedPairs: number; readonly addedSingles: number };
}

export interface CapacityAirport {
  readonly code: string;
  /** Paved runways in NASR, by ID. Empty when the airport has none. */
  readonly runways: readonly CapacityRunway[];
  /** Parallel-runway groups: the centerline spacings (ft) between neighbours in each group with 2+ runways. */
  readonly parallelSpacingsFt: readonly (readonly number[])[];
  /** Runways in the layout after counting parallels under 700 ft apart as one (0 when there are none). */
  readonly layoutRunways: number;
  /** Whether two non-parallel runways physically cross (null with fewer than two orientations). */
  readonly crossing: boolean | null;
  /** The Figure 2-1 configuration and ASV, or null when the layout could not be mapped. */
  readonly configuration: CapacityConfiguration | null;
  /**
   * The ASV the congestion KPI uses: the FAA capacity profile for a Core 30 airport, else the extended Figure 2-1
   * value when the layout goes beyond the figure, else the Figure 2-1 configuration. null when nothing applies.
   */
  readonly capacity: CapacityEstimate | null;
  /** Why configuration is null; absent when it is set. */
  readonly missingReason?: string;
}

export interface CapacityMeta {
  readonly source: string;
  /** NASR 28-day cycle effective date, "YYYY-MM-DD". */
  readonly nasrCycle: string;
  readonly method: string;
  /** No build date on purpose: two builds from the same NASR cycle give byte-identical files. */
  readonly airportCount: number;
  readonly mappedCount: number;
  /** Airports per capacity source (Core 30 profile, extended Figure 2-1, Figure 2-1). */
  readonly capacitySources: Readonly<Record<CapacitySource, number>>;
}

export interface CapacityDataset {
  readonly meta: CapacityMeta;
  readonly airports: Readonly<Record<string, CapacityAirport>>;
}
