// Shape of data/enplanements.json, the dataset built from the FAA enplanement workbooks
// by build.ts. Server-internal: the wire contract for any API stays in packages/shared.

/** FAA hub size for primary airports: Large, Medium, Small, Nonhub. */
export type HubType = "L" | "M" | "S" | "N";

/** FAA service level: P = primary, CS = non-primary commercial service. */
export type ServiceLevel = "P" | "CS";

/** One airport row from one year's workbook, after parsing. */
export interface YearRow {
  readonly airportCode: string;
  readonly name: string;
  readonly city: string;
  readonly state: string;
  readonly serviceLevel: ServiceLevel;
  readonly hubType: HubType | null;
  readonly rank: number | null;
  readonly enplanements: number;
  /** The prior-year figure printed in this same file (null when the FAA left it blank). */
  readonly priorYearEnplanements: number | null;
}

/** All airport rows of one year's workbook. */
export interface YearTable {
  readonly year: number;
  readonly rows: readonly YearRow[];
}

export interface SeriesPoint {
  readonly year: number;
  readonly enplanements: number;
  readonly rank: number | null;
  readonly hubType: HubType | null;
}

export interface LatestYear {
  readonly year: number;
  readonly enplanements: number;
  /** Prior-year figure from the latest year's own file. */
  readonly priorYear: number | null;
  /** (latest - priorYear) / priorYear * 100, or null without a prior-year figure. */
  readonly yoyChangePct: number | null;
  readonly rank: number | null;
}

export interface Trend {
  /** CAGR 2019 -> 2024 (5 periods), percent. */
  readonly cagr5yr: number | null;
  /** CAGR 2015 -> 2024. Despite the name this is 9 periods (n = 9), percent. */
  readonly cagr10yr: number | null;
  /** Latest-year enplanements / CY2019 enplanements (a ratio, 1 = fully recovered). */
  readonly recoveryVs2019: number | null;
}

export interface AirportRecord {
  readonly airportCode: string;
  readonly name: string;
  readonly city: string;
  readonly state: string;
  /** Hub type of the latest year the airport appears; null for non-primary airports. */
  readonly hubType: HubType | null;
  /** Ascending by year; years the airport is missing from are omitted. */
  readonly series: readonly SeriesPoint[];
  readonly latest: LatestYear;
  readonly trend: Trend;
}

export interface DatasetMeta {
  readonly source: string;
  readonly years: readonly number[];
  /** YYYY-MM-DD. The only field that changes between two builds of the same files. */
  readonly builtAt: string;
  /** Unique airport codes across all years. */
  readonly airportCount: number;
}

export interface EnplanementsDataset {
  readonly meta: DatasetMeta;
  readonly airports: Readonly<Record<string, AirportRecord>>;
}
