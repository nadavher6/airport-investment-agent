// The committed FAA runway-capacity dataset (data/capacity.json), typed. Built by build.ts.
import raw from "../../../../../data/capacity.json" with { type: "json" };
import type { CapacityAirport, CapacityDataset } from "./types.ts";

export const capacityDataset: CapacityDataset = raw as unknown as CapacityDataset;

/** Look up one airport's runway layout and ASV by FAA code (case-insensitive). null if absent. */
export function getCapacity(code: unknown): CapacityAirport | null {
  if (typeof code !== "string") return null;
  return capacityDataset.airports[code.trim().toUpperCase()] ?? null;
}
