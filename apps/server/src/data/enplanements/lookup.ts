// Runtime lookup over the committed FAA enplanements dataset. In-memory, no network.
import { enplanementsDataset, findAirport } from "./dataset.ts";
import type { AirportRecord } from "./types.ts";

/** An airport's record plus where the numbers come from. */
export type EnplanementResult = AirportRecord & { readonly source: string };

/**
 * The airport's enplanement record (code trimmed and uppercased), or null for an unknown code. Never invents data.
 * The dataset is keyed by FAA LocID (3 characters), so ICAO codes such as "KLAX" return null.
 * `code` is typed `unknown` because it can come straight from an LLM tool call; a non-string returns null.
 */
export function getEnplanements(code: unknown): EnplanementResult | null {
  if (typeof code !== "string") return null;
  const record = findAirport(code);
  return record === null ? null : { ...record, source: enplanementsDataset.meta.source };
}
