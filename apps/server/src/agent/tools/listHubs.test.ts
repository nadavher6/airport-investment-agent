import type { JsonValue } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { listHubsTool, type HubListItem, type ListHubsOutput } from "./listHubs.ts";

const ctx = { signal: new AbortController().signal };

/** Run the tool and return its typed output, failing the test if it errored. */
async function runList(input: JsonValue): Promise<ListHubsOutput> {
  const result = await listHubsTool.run(input, ctx);
  expect(result.ok, JSON.stringify(result)).toBe(true);
  // Narrowed by the assertion above; the wire output is this tool's own JSON shape.
  return (result as { ok: true; output: unknown }).output as ListHubsOutput;
}

describe("list_hubs tool", () => {
  it("is named list_hubs with a schema-valid example input", () => {
    expect(listHubsTool.name).toBe("list_hubs");
    expect(listHubsTool.description.length).toBeGreaterThan(0);
    expect(listHubsTool.inputSchema.safeParse(listHubsTool.exampleInput).success).toBe(true);
  });

  it("returns Large hubs sorted by latest enplanements by default (ATL first)", async () => {
    const out = await runList({});
    expect(out.hubType).toBe("L");
    expect(out.sortBy).toBe("enplanements");
    // 31 Large hubs in the committed dataset; default limit is 30, so the list truncates.
    expect(out.total).toBe(31);
    expect(out.airports.length).toBe(30);
    expect(out.airports[0]!.code).toBe("ATL");
    expect(out.airports[0]!.hubType).toBe("L");
    // Descending by latestEnplanements.
    const enps = out.airports.map((a) => a.latestEnplanements);
    expect([...enps].sort((a, b) => b - a)).toEqual(enps);
    // Only Large hubs are returned.
    expect(out.airports.every((a) => a.hubType === "L")).toBe(true);
    // Each row carries the documented shape, including the growth metrics.
    const atl = out.airports[0]!;
    expect(atl).toMatchObject({ code: "ATL", hubType: "L" } satisfies Partial<HubListItem>);
    expect(typeof atl.latestEnplanements).toBe("number");
    expect("cagr5yr" in atl && "cagr10yr" in atl).toBe(true);
  });

  it('sort_by "growth" orders Large hubs by cagr5yr descending (BNA fastest)', async () => {
    const out = await runList({ sort_by: "growth", limit: 100 });
    expect(out.sortBy).toBe("growth");
    expect(out.airports[0]!.code).toBe("BNA");
    const growth = out.airports.map((a) => a.cagr5yr ?? Number.NEGATIVE_INFINITY);
    // Descending (nulls, if any, treated as -Infinity and thus already last).
    expect([...growth].sort((a, b) => b - a)).toEqual(growth);
  });

  it("limit truncates the ranked list without changing its order or the reported total", async () => {
    const full = await runList({ hub_type: "L", sort_by: "enplanements", limit: 100 });
    const top3 = await runList({ hub_type: "L", sort_by: "enplanements", limit: 3 });
    expect(top3.airports.length).toBe(3);
    expect(top3.total).toBe(full.total);
    expect(top3.airports.map((a) => a.code)).toEqual(full.airports.slice(0, 3).map((a) => a.code));
  });

  it("sorts airports missing the growth metric last and never fabricates a value", async () => {
    // Nonhub airports include many without a cagr5yr; those must sort after the ones that have it.
    const out = await runList({ hub_type: "N", sort_by: "growth", limit: 100 });
    const firstNullIndex = out.airports.findIndex((a) => a.cagr5yr == null);
    if (firstNullIndex !== -1) {
      // No non-null growth value appears after the first null one.
      const after = out.airports.slice(firstNullIndex);
      expect(after.every((a) => a.cagr5yr == null)).toBe(true);
    }
    // Missing metrics are reported as null, not invented numbers.
    expect(out.airports.every((a) => a.cagr5yr === null || typeof a.cagr5yr === "number")).toBe(true);
  });

  it("applies defaults for an empty input and rejects unknown keys / out-of-range limits", async () => {
    // Defaults: hub_type L, sort_by enplanements, limit 30.
    const def = await runList({});
    expect(def.hubType).toBe("L");
    expect(def.airports.length).toBe(30);

    // .strict(): an unknown key is invalid_input.
    expect(await listHubsTool.run({ foo: 1 }, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    // limit out of range / non-integer / bad enum are rejected by the guardrail.
    for (const bad of [{ limit: 0 }, { limit: 101 }, { limit: 2.5 }, { hub_type: "X" }, { sort_by: "name" }]) {
      expect(await listHubsTool.run(bad, ctx), JSON.stringify(bad)).toMatchObject({
        ok: false,
        error: { code: "invalid_input" },
      });
    }
  });
});
