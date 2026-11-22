import { describe, expect, it } from "vitest";
import { findAirportsByCityTool } from "./findAirportsByCity.ts";
import { findAirportsByRegionTool } from "./findAirportsByRegion.ts";
import { getAirportByCodeTool } from "./getAirportByCode.ts";

describe("airport lookup tools", () => {
  it("have the expected names and required parameters", () => {
    expect(getAirportByCodeTool.name).toBe("get_airport_by_code");
    expect(getAirportByCodeTool.parameters.required).toEqual(["code"]);
    expect(findAirportsByCityTool.name).toBe("find_airports_by_city");
    expect(findAirportsByCityTool.parameters.required).toEqual(["cities"]);
    expect(findAirportsByRegionTool.name).toBe("find_airports_by_region");
    expect(findAirportsByRegionTool.parameters.required).toEqual(["region"]);
    for (const t of [getAirportByCodeTool, findAirportsByCityTool, findAirportsByRegionTool]) expect(t.description.length).toBeGreaterThan(0);
  });

  it("get_airport_by_code returns JFK for 'jfk' and not_found for ZZZ", () => {
    expect(getAirportByCodeTool.run({ code: "jfk" })).toMatchObject({ code: "JFK", hubType: "L" });
    expect(getAirportByCodeTool.run({ code: "ZZZ" })).toEqual({ error: "not_found" });
  });

  it("find_airports_by_city returns JSON-able per-city results", () => {
    const out = findAirportsByCityTool.run({ cities: ["New York", "NYC", "Bostn"] });
    expect(out.results["New York"]).toEqual(out.results["NYC"]);
    expect(out.results["Bostn"]).toMatchObject({ reason: "no_match", suggestions: ["Boston"] });
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("find_airports_by_region equals the city tool on the region's cities", () => {
    const region = findAirportsByRegionTool.run({ region: "West Coast" });
    expect(region.results).toEqual(findAirportsByCityTool.run({ cities: [...region.cities] }).results);
    expect(findAirportsByRegionTool.run({ region: "Narnia" })).toMatchObject({ reason: "no_match", cities: [] });
  });

  it("do not throw on missing or non-string input", () => {
    for (const bad of [123, null, {}, undefined]) {
      expect(getAirportByCodeTool.run({ code: bad })).toEqual({ error: "not_found" });
      expect(findAirportsByCityTool.run({ cities: bad })).toEqual({ results: {} });
      expect(findAirportsByRegionTool.run({ region: bad })).toMatchObject({ reason: "no_match" });
    }
    expect(getAirportByCodeTool.run({})).toEqual({ error: "not_found" });
  });
});
