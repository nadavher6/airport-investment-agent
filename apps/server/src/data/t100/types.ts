// Shape of data/t100.json, built from BTS T-100 by src/data/t100/build.ts.
// Server-internal: nothing here is part of the wire contract.

export interface T100Airport {
  readonly code: string;
  /** Total departures performed (operations) in the year. */
  readonly departures: number;
  readonly passengers: number;
  readonly seats: number;
  readonly domesticSeats: number;
  readonly internationalSeats: number;
  /** passengers / seats, percent. */
  readonly loadFactor: number;
  /** internationalSeats / seats, percent. */
  readonly internationalShare: number;
}

export interface T100Meta {
  readonly source: string;
  /** Start of the trailing-12-month window, "YYYY-MM". */
  readonly periodStart: string;
  /** End (latest reported month) of the window, "YYYY-MM". */
  readonly periodEnd: string;
  readonly months: number;
  readonly builtAt: string;
  readonly airportCount: number;
}

export interface T100Dataset {
  readonly meta: T100Meta;
  readonly airports: Readonly<Record<string, T100Airport>>;
}
