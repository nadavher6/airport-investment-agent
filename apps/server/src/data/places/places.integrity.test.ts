import { describe, expect, it } from "vitest";
import { enplanementsDataset } from "../enplanements/dataset.ts";
import { metrosFile, regionsFile } from "./files.ts";
import { normalizePlace } from "./text.ts";

const metros = Object.entries(metrosFile.metros);
const REGIONS = ["West Coast", "East Coast", "New England", "Midwest", "Pacific Northwest", "Southwest", "Southeast", "Mountain West", "Gulf Coast"];

describe("metros.json / regions.json integrity (real files)", () => {
  it("every airport code in metros.json exists in enplanements.json", () => {
    const missing = metros.flatMap(([name, m]) =>
      m.airports.filter((a) => !Object.hasOwn(enplanementsDataset.airports, a.code)).map((a) => `${name}:${a.code}`),
    );
    expect(missing).toEqual([]);
  });

  it("every city in regions.json is a metro name in metros.json", () => {
    const missing = Object.entries(regionsFile.regions).flatMap(([region, r]) =>
      r.cities.filter((c) => !Object.hasOwn(metrosFile.metros, c)).map((c) => `${region}:${c}`),
    );
    expect(missing).toEqual([]);
  });

  it("covers the nine regions the issue names, each with at least one city", () => {
    for (const region of REGIONS) expect(regionsFile.regions[region]?.cities.length ?? 0).toBeGreaterThan(0);
  });

  it("has a metro for every Large and Medium hub", () => {
    const covered = new Set(metros.flatMap(([, m]) => m.airports.map((a) => a.code)));
    const uncovered = Object.values(enplanementsDataset.airports)
      .filter((a) => a.hubType === "L" || a.hubType === "M")
      .map((a) => a.airportCode)
      .filter((code) => !covered.has(code));
    expect(uncovered).toEqual([]);
  });

  it("every metro has airports, no duplicate codes inside a metro, and at least one non-secondary airport", () => {
    for (const [name, m] of metros) {
      const codes = m.airports.map((a) => a.code);
      expect(codes.length, name).toBeGreaterThan(0);
      expect(new Set(codes).size, name).toBe(codes.length);
      expect(m.airports.some((a) => !a.secondary), name).toBe(true);
    }
  });

  it("names and aliases are unique across metros (after normalizing), and region cities are not repeated", () => {
    const seen = new Map<string, string>();
    for (const [name, m] of metros) {
      for (const text of [name, ...m.aliases]) {
        const key = normalizePlace(text);
        expect(seen.get(key), `"${text}" of ${name} clashes with ${seen.get(key)}`).toBeUndefined();
        seen.set(key, name);
      }
    }
    for (const [region, r] of Object.entries(regionsFile.regions)) {
      expect(new Set(r.cities).size, region).toBe(r.cities.length);
    }
  });

  it("secondary is true exactly when the airport has under 20% of the metro's largest airport (rule in data/SOURCES.md)", () => {
    for (const [name, m] of metros) {
      const enpl = (code: string): number => enplanementsDataset.airports[code]?.latest.enplanements ?? 0;
      const top = Math.max(...m.airports.map((a) => enpl(a.code)));
      for (const a of m.airports) expect(a.secondary, `${name}:${a.code}`).toBe(enpl(a.code) < 0.2 * top);
    }
  });
});
