// The committed FAA enplanements dataset (data/enplanements.json), typed. Server code imports
// the data from here, never the JSON file directly, so the path and the cast live in one place.
//
// Why a plain JSON import works: the tsconfigs use `noEmit` with no `rootDir`, so importing a file
// outside apps/server/src is allowed (resolveJsonModule is on in tsconfig.base.json). tsx and
// vitest load it natively with the `type: "json"` import attribute. TypeScript infers the JSON's
// hub types as `string`, so the value is cast once to the hand-written EnplanementsDataset type;
// dataset.test.ts checks the real file against that type's rules.
import raw from "../../../../../data/enplanements.json" with { type: "json" };
import type { AirportRecord, EnplanementsDataset } from "./types.ts";

export const enplanementsDataset: EnplanementsDataset = raw as unknown as EnplanementsDataset;

/** The airport's record, by FAA Locid (case-insensitive), or null if it is not in the dataset. */
export function findAirport(code: string): AirportRecord | null {
  const key = code.trim().toUpperCase();
  return Object.hasOwn(enplanementsDataset.airports, key) ? (enplanementsDataset.airports[key] ?? null) : null;
}
