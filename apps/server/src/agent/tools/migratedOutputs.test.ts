import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { JsonObject } from "@airport/shared";
import { getTool } from "./registry.ts";

/**
 * Proof that moving the four tools onto the Tool contract (#30) kept their outputs.
 * `fixtures/main-tool-outputs.json` was recorded by running the ORIGINAL tool code from
 * origin/main (b786731: the hand-written `run()` of getEnplanements, getAirportByCode,
 * findAirportsByCity, findAirportsByRegion) on the inputs below. The migrated tools must
 * return exactly that object as their `ok` output, caveats and all (no_enplanement_data,
 * not_found, no_match + suggestions, secondary, truncated).
 */
interface Baseline {
  readonly get_enplanements: Readonly<Record<string, unknown>>;
  readonly get_airport_by_code: Readonly<Record<string, unknown>>;
  readonly find_airports_by_city: readonly { readonly cities: readonly string[]; readonly output: unknown }[];
  readonly find_airports_by_region: Readonly<Record<string, unknown>>;
}

const baseline: Baseline = JSON.parse(
  readFileSync(new URL("./fixtures/main-tool-outputs.json", import.meta.url), "utf8"),
) as Baseline;
const ctx = { signal: new AbortController().signal };

async function runTool(name: string, input: JsonObject): Promise<unknown> {
  const tool = getTool(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.run(input, ctx);
}

describe("migrated tools return exactly main's outputs", () => {
  it("the fixture covers the caveat cases", () => {
    expect(Object.keys(baseline.get_enplanements)).toEqual(["LAX", " lax ", "ZZZ", "KLAX"]);
    expect(Object.keys(baseline.get_airport_by_code)).toEqual(["LAX", "jfk", "ZZZ"]);
    expect(Object.keys(baseline.find_airports_by_region)).toEqual(["West Coast", "Pacific Northwest", "Wst Coast", "Texas"]);
    const text = JSON.stringify(baseline);
    for (const caveat of ['"no_enplanement_data"', '"not_found"', '"no_match"', '"suggestions"', '"secondary":true', '"truncated"']) {
      expect(text, caveat).toContain(caveat);
    }
  });

  it.each(Object.entries(baseline.get_enplanements))("get_enplanements %j", async (code, expected) => {
    expect(await runTool("get_enplanements", { airport_code: code })).toEqual({ ok: true, output: expected });
  });

  it.each(Object.entries(baseline.get_airport_by_code))("get_airport_by_code %j", async (code, expected) => {
    expect(await runTool("get_airport_by_code", { code })).toEqual({ ok: true, output: expected });
  });

  it.each(baseline.find_airports_by_city.map((c) => [c.cities.slice(0, 3).join(", "), c] as const))(
    "find_airports_by_city [%s ...]",
    async (_label, { cities, output }) => {
      expect(await runTool("find_airports_by_city", { cities: [...cities] })).toEqual({ ok: true, output });
    },
  );

  it.each(Object.entries(baseline.find_airports_by_region))("find_airports_by_region %j", async (region, expected) => {
    expect(await runTool("find_airports_by_region", { region })).toEqual({ ok: true, output: expected });
  });
});
