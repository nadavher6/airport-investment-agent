import { describe, expect, it } from "vitest";
import { getEnplanementsTool } from "./getEnplanements.ts";

describe("get_enplanements tool", () => {
  it("is named get_enplanements and requires airport_code", () => {
    expect(getEnplanementsTool.name).toBe("get_enplanements");
    expect(getEnplanementsTool.parameters.required).toEqual(["airport_code"]);
    expect(getEnplanementsTool.description.length).toBeGreaterThan(0);
  });

  it("run for LAX returns the real record", () => {
    const result = getEnplanementsTool.run({ airport_code: "LAX" });
    expect(result).toMatchObject({ airportCode: "LAX", hubType: "L", latest: { year: 2024, enplanements: 37760834 } });
  });

  it("run for ZZZ returns no_enplanement_data", () => {
    expect(getEnplanementsTool.run({ airport_code: "zzz " })).toEqual({
      airport_code: "ZZZ",
      error: "no_enplanement_data",
    });
  });

  it("description pins the cagr windows: 9 periods, not a 10-year CAGR", () => {
    const { description } = getEnplanementsTool;
    expect(description).toContain("CY2015-CY2024");
    expect(description).toContain("cagr10yr is the 2015->2024 rate (9 periods, not 10");
    expect(description).toContain("cagr5yr is the 2019->2024 rate (5 periods)");
    expect(description).not.toMatch(/10-year CAGR\b(?!\))/);
  });

  it("description and parameter doc say ICAO codes such as KLAX are not found", () => {
    expect(getEnplanementsTool.description).toContain("'KLAX' are not found");
    expect(getEnplanementsTool.run({ airport_code: "KLAX" })).toEqual({ airport_code: "KLAX", error: "no_enplanement_data" });
  });

  it("run does not throw on a non-string or missing airport_code", () => {
    for (const bad of [123, null, {}, undefined]) {
      expect(getEnplanementsTool.run({ airport_code: bad })).toEqual({ airport_code: "", error: "no_enplanement_data" });
    }
    expect(getEnplanementsTool.run({})).toEqual({ airport_code: "", error: "no_enplanement_data" });
  });
});
