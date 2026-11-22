// list_hubs, on the shared Tool contract (Zod guardrail + shared error).
import { z } from "zod";
import { enplanementsDataset } from "../../data/enplanements/dataset.ts";
import type { AirportRecord, HubType } from "../../data/enplanements/types.ts";
import { defineTool, ok } from "./tool.ts";

/** Most airports one call may enumerate; a longer list is noise for a ranking question. */
export const MAX_LISTED_HUBS = 100;
/** Default list length when the caller does not pass `limit`. */
export const DEFAULT_LISTED_HUBS = 30;

/** One ranked row: the facts a broad "which airports" question needs, nothing more. */
export interface HubListItem {
  readonly code: string;
  readonly name: string;
  readonly hubType: HubType;
  /** Latest-year enplanements (the sort key for sort_by "enplanements"). */
  readonly latestEnplanements: number;
  /** CAGR 2019->2024 (5 periods), percent; null if the dataset has no value. Sort key for "growth". */
  readonly cagr5yr: number | null;
  /** CAGR 2015->2024 (9 periods, not a true 10-year rate), percent; null if absent. */
  readonly cagr10yr: number | null;
}

const inputSchema = z
  .object({
    hub_type: z.enum(["L", "M", "S", "N"]).default("L"),
    sort_by: z.enum(["growth", "enplanements"]).default("enplanements"),
    limit: z.number().int().min(1).max(MAX_LISTED_HUBS).default(DEFAULT_LISTED_HUBS),
  })
  .strict();

export type ListHubsInput = z.infer<typeof inputSchema>;
export type ListHubsOutput = {
  readonly hubType: HubType;
  readonly sortBy: "growth" | "enplanements";
  readonly total: number;
  readonly airports: readonly HubListItem[];
};

/** Nulls (and NaN) sort last; otherwise numeric descending. */
function compareDesc(a: number | null, b: number | null): number {
  const av = a ?? Number.NEGATIVE_INFINITY;
  const bv = b ?? Number.NEGATIVE_INFINITY;
  if (av === bv) return 0;
  return av > bv ? -1 : 1;
}

function toItem(record: AirportRecord): HubListItem {
  return {
    code: record.airportCode,
    name: record.name,
    // Filtered on hubType !== null below, so the cast is sound.
    hubType: record.hubType as HubType,
    latestEnplanements: record.latest.enplanements,
    cagr5yr: record.trend.cagr5yr,
    cagr10yr: record.trend.cagr10yr,
  };
}

export const listHubsTool = defineTool<ListHubsInput, ListHubsOutput>({
  name: "list_hubs",
  description:
    "Enumerate US airports of one FAA hub class from the committed FAA enplanement dataset (CY2015-CY2024), " +
    "ranked, so a broad 'which / rank airports' question starts from the REAL candidate list instead of a guess. " +
    "hub_type is L (Large, default), M (Medium), S (Small) or N (Nonhub). sort_by 'enplanements' (default) ranks " +
    "by latest-year passenger boardings (busiest first); 'growth' ranks by cagr5yr (the 2019->2024 rate, fastest " +
    "first). Each row is { code, name, hubType, latestEnplanements, cagr5yr, cagr10yr } (cagr5yr/cagr10yr in " +
    "percent; cagr10yr spans 9 periods, not a true 10-year rate). Airports missing the sort metric sort last; " +
    "limit (default 30, max 100) truncates. Use it to get the candidates, then score_airports (max 5) for depth.",
  inputSchema,
  exampleInput: { hub_type: "L", sort_by: "enplanements", limit: 30 },
  run: (input) => {
    const items = Object.values(enplanementsDataset.airports)
      .filter((record) => record.hubType === input.hub_type)
      .map(toItem);
    // Deterministic: primary metric descending (nulls last), then airport code ascending for ties.
    items.sort((a, b) => {
      const primary =
        input.sort_by === "growth"
          ? compareDesc(a.cagr5yr, b.cagr5yr)
          : compareDesc(a.latestEnplanements, b.latestEnplanements);
      return primary !== 0 ? primary : a.code.localeCompare(b.code);
    });
    return Promise.resolve(
      ok({
        hubType: input.hub_type,
        sortBy: input.sort_by,
        total: items.length,
        airports: items.slice(0, input.limit),
      }),
    );
  },
});
