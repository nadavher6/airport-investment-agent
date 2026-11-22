// The committed place files (data/metros.json, data/regions.json), typed. Same pattern as
// ../enplanements/dataset.ts: the JSON import is cast once, and the integrity test checks the real files.
import rawMetros from "../../../../../data/metros.json" with { type: "json" };
import rawRegions from "../../../../../data/regions.json" with { type: "json" };
import type { MetrosFile, RegionsFile } from "./types.ts";

export const metrosFile: MetrosFile = rawMetros as unknown as MetrosFile;
export const regionsFile: RegionsFile = rawRegions as unknown as RegionsFile;
