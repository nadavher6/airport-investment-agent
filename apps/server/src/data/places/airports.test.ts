import { describe, expect, it } from "vitest";
import { MAX_CITIES, findAirportsByCity, findAirportsByRegion, getAirportByCode } from "./airports.ts";
import type { CityResult } from "./airports.ts";
import { isCloseMatch, levenshtein, normalizePlace } from "./text.ts";

const codes = (r: CityResult | undefined): string[] => (r?.airports ?? []).map((a) => a.code);

describe("text helpers", () => {
  it("normalizePlace trims, lowercases, strips punctuation and 'the'", () => {
    expect(normalizePlace("  The New-York, City! ")).toBe("new york city");
    expect(normalizePlace("Washington D.C.")).toBe("washington dc");
  });
  it("levenshtein and isCloseMatch", () => {
    expect(levenshtein("bostn", "boston")).toBe(1);
    expect(isCloseMatch("bostn", "boston")).toBe(true);
    expect(isCloseMatch("atlantis", "atlanta")).toBe(false);
    expect(isCloseMatch("boston", "boston")).toBe(false);
  });
});

describe("getAirportByCode", () => {
  it("returns the JFK record for 'jfk' (trimmed, any case)", () => {
    expect(getAirportByCode(" jfk ")).toMatchObject({ code: "JFK", city: "New York", state: "NY", hubType: "L", latestEnplanements: 31466102 });
  });
  it("returns not_found for ZZZ and for non-strings", () => {
    expect(getAirportByCode("ZZZ")).toEqual({ error: "not_found" });
    expect(getAirportByCode(42)).toEqual({ error: "not_found" });
  });
});

describe("findAirportsByCity", () => {
  it("New York and NYC give the same list with JFK, LGA and EWR", () => {
    const { results } = findAirportsByCity(["New York", "NYC"]);
    expect(codes(results["New York"])).toEqual(expect.arrayContaining(["JFK", "LGA", "EWR"]));
    expect(results["NYC"]).toEqual(results["New York"]);
    expect(results["New York"]).toMatchObject({ matchedAs: "metro" });
  });

  it("marks HPN and ISP secondary, sorted by enplanements highest first", () => {
    const list = findAirportsByCity(["New York"]).results["New York"]?.airports ?? [];
    expect(list.map((a) => a.code)).toEqual(["JFK", "EWR", "LGA", "HPN", "ISP"]);
    expect(list.map((a) => a.secondary)).toEqual([false, false, false, true, true]);
    const nums = list.map((a) => a.latestEnplanements);
    expect(nums).toEqual([...nums].sort((a, b) => b - a));
  });

  it("Los Angeles marks BUR, LGB, ONT and SNA secondary", () => {
    const list = findAirportsByCity(["Los Angeles"]).results["Los Angeles"]?.airports ?? [];
    expect(list.filter((a) => a.secondary).map((a) => a.code).sort()).toEqual(["BUR", "LGB", "ONT", "SNA"]);
  });

  it("Bay Area gives SFO, OAK and SJC", () => {
    expect(codes(findAirportsByCity(["Bay Area"]).results["Bay Area"]).sort()).toEqual(["OAK", "SFO", "SJC"]);
  });

  it("Bostn is empty with the suggestion Boston and is not swapped in", () => {
    expect(findAirportsByCity(["Bostn"]).results["Bostn"]).toEqual({ airports: [], reason: "no_match", suggestions: ["Boston"] });
  });

  it("Atlantis is empty, no_match, without suggestions", () => {
    const r = findAirportsByCity(["Atlantis"]).results["Atlantis"];
    expect(r).toEqual({ airports: [], reason: "no_match" });
  });

  it("falls back to the dataset city text (Hebron is not a metro name or alias, only a dataset city)", () => {
    const r = findAirportsByCity(["Hebron"]).results["Hebron"];
    expect(r).toMatchObject({ matchedAs: "city" });
    expect(codes(r)).toEqual(["CVG"]);
    expect(r?.airports[0]?.secondary).toBe(false);
  });

  it("is tolerant of bad input and keeps the caller's spelling as the key", () => {
    expect(findAirportsByCity(undefined)).toEqual({ results: {} });
    expect(findAirportsByCity([1, null, "  the DC "]).results).toHaveProperty("  the DC ");
    expect(findAirportsByCity([""]).results[""]).toEqual({ airports: [], reason: "no_match" });
  });
});

describe("findAirportsByRegion", () => {
  it("West Coast lists the expected cities and airports", () => {
    const r = findAirportsByRegion("West Coast");
    expect(r).toMatchObject({ region: "West Coast", matchedAs: "region" });
    expect(r.cities).toEqual(expect.arrayContaining(["Seattle", "Portland", "San Francisco Bay Area", "Los Angeles", "San Diego"]));
    const all = Object.values(r.results).flatMap((c) => codes(c));
    expect(all).toEqual(expect.arrayContaining(["SEA", "PDX", "SFO", "LAX", "SAN"]));
  });

  it("New England includes BOS, PVD, BDL and MHT", () => {
    const all = Object.values(findAirportsByRegion("new england").results).flatMap((c) => codes(c));
    expect(all).toEqual(expect.arrayContaining(["BOS", "PVD", "BDL", "MHT"]));
  });

  it("matches an alias and returns the canonical region name", () => {
    expect(findAirportsByRegion("the PNW")).toMatchObject({ region: "Pacific Northwest", matchedAs: "region" });
  });

  it("equals the city tool's result for the region's city list", () => {
    for (const name of ["West Coast", "New England", "Midwest", "Gulf Coast"]) {
      const r = findAirportsByRegion(name);
      expect(r.results).toEqual(findAirportsByCity(r.cities).results);
      expect(Object.keys(r.results)).toEqual(r.cities);
    }
  });

  it("unknown region returns no_match; a close name is suggested, not used", () => {
    expect(findAirportsByRegion("Narnia")).toEqual({ region: "Narnia", cities: [], results: {}, reason: "no_match" });
    expect(findAirportsByRegion("Midwst")).toEqual({ region: "Midwst", cities: [], results: {}, reason: "no_match", suggestions: ["Midwest"] });
    expect(findAirportsByRegion(undefined)).toMatchObject({ region: "", reason: "no_match" });
  });
});

describe("speed", () => {
  it("each lookup takes under 5 ms", () => {
    const time = (fn: () => unknown): number => {
      const t = performance.now();
      fn();
      return performance.now() - t;
    };
    expect(time(() => getAirportByCode("JFK"))).toBeLessThan(5);
    expect(time(() => findAirportsByCity(["New York"]))).toBeLessThan(5);
    expect(time(() => findAirportsByCity(["Bostn"]))).toBeLessThan(5);
    expect(time(() => findAirportsByRegion("West Coast"))).toBeLessThan(5);
  });
});

describe("find_airports_by_city limits and odd names", () => {
  it("resolves the first 50 distinct names and reports how many were left out", () => {
    const names = Array.from({ length: MAX_CITIES + 30 }, (_, i) => `Nowhereville ${String.fromCharCode(97 + (i % 26))}${i}`);
    const r = findAirportsByCity(names);
    expect(Object.keys(r.results)).toEqual(names.slice(0, MAX_CITIES));
    expect(r.truncated).toEqual({ limit: MAX_CITIES, omitted: 30 });
  });

  it("does not mark a list of exactly 50 as truncated, and duplicates do not count", () => {
    const names = Array.from({ length: MAX_CITIES }, (_, i) => `Zed ${i}`);
    expect(findAirportsByCity([...names, ...names]).truncated).toBeUndefined();
    expect(Object.keys(findAirportsByCity(names).results)).toHaveLength(MAX_CITIES);
  });

  it("keeps '__proto__' and 'constructor' as ordinary city names", () => {
    const r = findAirportsByCity(["__proto__", "constructor", "Boston"]);
    expect(Object.keys(r.results)).toEqual(["__proto__", "constructor", "Boston"]);
    expect(Object.hasOwn(r.results, "__proto__")).toBe(true);
    expect(r.results["__proto__"]).toMatchObject({ airports: [], reason: "no_match" });
    expect(r.results["constructor"]).toMatchObject({ airports: [], reason: "no_match" });
    expect(codes(r.results["Boston"])).toContain("BOS");
  });
});
