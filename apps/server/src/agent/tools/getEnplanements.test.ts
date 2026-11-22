import { describe, expect, it } from "vitest";
import { getEnplanementsTool } from "./getEnplanements.ts";

const ctx = { signal: new AbortController().signal };

describe("get_enplanements tool", () => {
  it("is named get_enplanements with an example input", () => {
    expect(getEnplanementsTool.name).toBe("get_enplanements");
    expect(getEnplanementsTool.exampleInput).toEqual({ airport_code: "LAX" });
    expect(getEnplanementsTool.description.length).toBeGreaterThan(0);
  });

  it("returns the real record for LAX", async () => {
    expect(await getEnplanementsTool.run({ airport_code: "LAX" }, ctx)).toMatchObject({
      ok: true,
      output: { airportCode: "LAX", hubType: "L", latest: { year: 2024, enplanements: 37760834 } },
    });
  });

  it("returns a no_enplanement_data output for an unknown code (trimmed + uppercased)", async () => {
    expect(await getEnplanementsTool.run({ airport_code: "zzz " }, ctx)).toEqual({
      ok: true,
      output: { airport_code: "ZZZ", error: "no_enplanement_data" },
    });
  });

  it("description pins the cagr windows: 9 periods, not a 10-year CAGR", () => {
    const { description } = getEnplanementsTool;
    expect(description).toContain("CY2015-CY2024");
    expect(description).toContain("cagr10yr is the 2015->2024 rate (9 periods, not 10");
    expect(description).toContain("cagr5yr is the 2019->2024 rate (5 periods)");
  });

  it("ICAO codes such as KLAX are documented and not found", async () => {
    expect(getEnplanementsTool.description).toContain("'KLAX' are not found");
    expect(await getEnplanementsTool.run({ airport_code: "KLAX" }, ctx)).toEqual({
      ok: true,
      output: { airport_code: "KLAX", error: "no_enplanement_data" },
    });
  });

  it("rejects a non-string or missing airport_code with invalid_input (the Zod guardrail)", async () => {
    for (const bad of [123, null, {}]) {
      expect(await getEnplanementsTool.run({ airport_code: bad }, ctx)).toMatchObject({
        ok: false,
        error: { code: "invalid_input" },
      });
    }
    expect(await getEnplanementsTool.run({}, ctx)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
  });
});
