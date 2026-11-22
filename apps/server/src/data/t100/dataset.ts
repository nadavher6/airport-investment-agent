// The committed BTS T-100 dataset (data/t100.json), typed. Built by build.ts.
import raw from "../../../../../data/t100.json" with { type: "json" };
import type { T100Airport, T100Dataset } from "./types.ts";

export const t100Dataset: T100Dataset = raw as unknown as T100Dataset;

/** Look up one airport's T-100 stats by 3-letter code (case-insensitive). null if absent. */
export function getT100(code: unknown): T100Airport | null {
  if (typeof code !== "string") return null;
  return t100Dataset.airports[code.trim().toUpperCase()] ?? null;
}
