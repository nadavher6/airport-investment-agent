// Shapes of the hand-curated place files data/metros.json and data/regions.json.
// Server-internal: nothing here is part of the wire contract.

export interface MetroAirport {
  /** FAA LocID; must exist in data/enplanements.json (checked by places.integrity.test.ts). */
  readonly code: string;
  /** A smaller airport serving the metro alongside its main one(s); see data/raw/SOURCES.md. */
  readonly secondary: boolean;
}

export interface Metro {
  readonly aliases: readonly string[];
  readonly airports: readonly MetroAirport[];
}

export interface MetrosFile {
  readonly metros: Readonly<Record<string, Metro>>;
}

export interface Region {
  readonly aliases: readonly string[];
  /** Metro names; every one must be a key of metros.json. */
  readonly cities: readonly string[];
}

export interface RegionsFile {
  readonly regions: Readonly<Record<string, Region>>;
}
