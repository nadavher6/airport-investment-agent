import { describe, expect, it } from "vitest";
import { findAirportsByCityTool } from "./findAirportsByCity.ts";
import { findAirportsByRegionTool } from "./findAirportsByRegion.ts";
import { getAirportByCodeTool } from "./getAirportByCode.ts";
import type { CitiesResult, RegionResult } from "../../data/places/airports.ts";

const ctx = { signal: new AbortController().signal };

describe("airport lookup tools (Tool contract)", () => {
  it("expose names, descriptions, and example inputs", () => {
    expect(getAirportByCodeTool.name).toBe("get_airport_by_code");
    expect(getAirportByCodeTool.exampleInput).toEqual({ code: "JFK" });
    expect(findAirportsByCityTool.name).toBe("find_airports_by_city");
    expect(findAirportsByRegionTool.name).toBe("find_airports_by_region");
    for (const t of [getAirportByCodeTool, findAirportsByCityTool, findAirportsByRegionTool]) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("get_airport_by_code returns JFK for 'jfk' and a not_found output for ZZZ", async () => {
    expect(await getAirportByCodeTool.run({ code: "jfk" }, ctx)).toMatchObject({
      ok: true,
      output: { code: "JFK", hubType: "L" },
    });
    expect(await getAirportByCodeTool.run({ code: "ZZZ" }, ctx)).toEqual({ ok: true, output: { error: "not_found" } });
  });

  it("find_airports_by_city returns JSON-able per-city results (no_match is output, not an error)", async () => {
    const res = await findAirportsByCityTool.run({ cities: ["New York", "NYC", "Bostn"] }, ctx);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const out = res.output as unknown as CitiesResult;
    expect(out.results["New York"]).toEqual(out.results["NYC"]);
    expect(out.results["Bostn"]).toMatchObject({ reason: "no_match", suggestions: ["Boston"] });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("find_airports_by_region equals the city tool on the region's cities", async () => {
    const regionRes = await findAirportsByRegionTool.run({ region: "West Coast" }, ctx);
    expect(regionRes.ok).toBe(true);
    if (!regionRes.ok) return;
    const region = regionRes.output as unknown as RegionResult;
    const cityRes = await findAirportsByCityTool.run({ cities: [...region.cities] }, ctx);
    if (!cityRes.ok) throw new Error("expected ok");
    expect(region.results).toEqual((cityRes.output as unknown as CitiesResult).results);

    const narnia = await findAirportsByRegionTool.run({ region: "Narnia" }, ctx);
    expect(narnia).toMatchObject({ ok: true, output: { reason: "no_match", cities: [] } });
  });

  it("rejects malformed/missing input with a shared invalid_input error (the Zod guardrail)", async () => {
    for (const bad of [123, null, {}]) {
      expect(await getAirportByCodeTool.run({ code: bad }, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    }
    expect(await getAirportByCodeTool.run({}, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await findAirportsByCityTool.run({ cities: 123 }, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await findAirportsByCityTool.run({ cities: [] }, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await findAirportsByRegionTool.run({ region: null }, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });
});
