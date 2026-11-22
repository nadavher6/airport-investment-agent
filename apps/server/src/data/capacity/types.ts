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
}

export interface CapacityAirport {
  readonly code: string;
  /** Paved runways in NASR, by ID. Empty when the airport has none. */
  readonly runways: readonly CapacityRunway[];
  /** Parallel-runway groups: the centerline spacings (ft) between neighbours in each group with 2+ runways. */
  readonly parallelSpacingsFt: readonly (readonly number[])[];
  /** Whether two non-parallel runways physically cross (null with fewer than two orientations). */
  readonly crossing: boolean | null;
  /** The Figure 2-1 configuration and ASV, or null when the layout could not be mapped. */
  readonly configuration: CapacityConfiguration | null;
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
}

export interface CapacityDataset {
  readonly meta: CapacityMeta;
  readonly airports: Readonly<Record<string, CapacityAirport>>;
}
