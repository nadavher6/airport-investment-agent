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
});
