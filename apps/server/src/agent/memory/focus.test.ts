import { describe, expect, it } from "vitest";
import { extractExplicitCodes, resolveFocus } from "./focus.ts";
import { selectFocusedRecords } from "./assemble.ts";
import { findAirportsByCityTool } from "../tools/findAirportsByCity.ts";
import { findAirportsByRegionTool } from "../tools/findAirportsByRegion.ts";

/** The codes #23's city tool returns for one name: the single source of truth for places. */
const cityCodes = (city: string): string[] =>
  findAirportsByCityTool.run({ cities: [city] }).results[city]?.airports.map((a) => a.code) ?? [];
import type { AirportRecord, MemoryState } from "./types.ts";

const unique = (xs: readonly string[]): string[] => [...new Set(xs)];

const state = (over: Partial<MemoryState> = {}): MemoryState => ({
  workingSet: new Map<string, AirportRecord>(),
  focusStack: [],
  lastPresentedList: [],
  ...over,
});

describe("extractExplicitCodes", () => {
  it("picks up all-caps 3-letter codes", () => {
    expect(extractExplicitCodes("Compare LAX and SFO")).toEqual(["LAX", "SFO"]);
  });

  it("ignores common all-caps words that are not codes", () => {
    expect(extractExplicitCodes("WHY is LAX higher")).toEqual(["LAX"]);
  });

  it("accepts only codes get_airport_by_code confirms, in any case", () => {
    expect(extractExplicitCodes("add bos")).toEqual(["BOS"]);
    expect(extractExplicitCodes("compare lax and Sfo")).toEqual(["LAX", "SFO"]);
    expect(extractExplicitCodes("How does the FAA rank the USA hubs?")).toEqual([]);
    expect(extractExplicitCodes("What ROI would the CEO expect?")).toEqual([]);
    expect(extractExplicitCodes("Is ZZQ a hub?")).toEqual([]);
  });

  it("does not replace the focus with non-airport caps words", () => {
    const r = resolveFocus("How does the FAA rank the USA hubs?", state({ focusStack: ["LAX"] }));
    expect(r.codes).toEqual([]);
    expect(r.focusStack).toEqual(["LAX"]);
  });

  it("resolves city names with find_airports_by_city (#23), not a local table", () => {
    expect(extractExplicitCodes("add Denver to the comparison")).toEqual(cityCodes("Denver"));
    expect(extractExplicitCodes("look at the Bay Area")).toEqual(cityCodes("Bay Area"));
    expect(extractExplicitCodes("what about Seattle?")).toEqual(cityCodes("Seattle"));
    const ny = extractExplicitCodes("rank New York airports");
    expect(ny).toEqual(cityCodes("New York"));
    expect(ny).toEqual(expect.arrayContaining(["JFK", "LGA", "EWR", "HPN", "ISP"]));
  });

  it("resolves region names with find_airports_by_region (#23)", () => {
    const region = findAirportsByRegionTool.run({ region: "Pacific Northwest" });
    const expected = [...new Set(region.cities.flatMap((c) => region.results[c]?.airports.map((a) => a.code) ?? []))];
    expect(expected.length).toBeGreaterThan(0);
    expect(extractExplicitCodes("invest in the Pacific Northwest")).toEqual(expected);
  });

  it("'NYC' resolves through the city tool and is never itself a code", () => {
    const codes = extractExplicitCodes("Compare JFK and NYC");
    expect(codes).not.toContain("NYC");
    expect(codes).toEqual([...new Set(["JFK", ...cityCodes("NYC")])]);
  });

  it("a multi-word city wins over a code inside it", () => {
    expect(extractExplicitCodes("San Diego vs Las Vegas")).toEqual([...cityCodes("San Diego"), ...cityCodes("Las Vegas")]);
    expect(extractExplicitCodes("San Diego vs Las Vegas")).toEqual(expect.arrayContaining(["SAN", "LAS"]));
  });

  it("finds no places in a general question", () => {
    expect(extractExplicitCodes("what does unmet demand mean for capacity growth?")).toEqual([]);
  });
});

describe("resolveFocus", () => {
  it("targets explicitly named airports and fronts them on the stack", () => {
    const r = resolveFocus("Compare LAX and SFO for investment", state());
    expect(r.codes).toEqual(["LAX", "SFO"]);
    expect(r.focusStack).toEqual(["LAX", "SFO"]);
    expect(r.ambiguous).toBe(false);
  });

  it("'add X' extends the current focus instead of replacing it", () => {
    const r = resolveFocus("add Denver to the comparison", state({ focusStack: ["LAX", "SFO"] }));
    expect(r.codes).toEqual(unique(["DEN", ...cityCodes("Denver"), "LAX", "SFO"]));
    expect(r.explicitCodes).toEqual(cityCodes("Denver"));
  });

  it("'add X' with a full focus stack keeps X and trims the oldest focus (K-cap)", () => {
    const stack = ["ATL", "LAX", "ORD", "JFK", "SEA", "BOS", "SFO", "MIA"];
    const ws = new Map<string, AirportRecord>(
      [...stack, "DEN"].map((c) => [c, { airportCode: c, enplanements: { cy2024: 1 } }]),
    );
    const r = resolveFocus("add DEN", state({ workingSet: ws, focusStack: stack }));
    expect(r.focusStack[0]).toBe("DEN");
    expect(r.focusStack).toHaveLength(8);
    expect(r.focusStack).not.toContain("MIA");
    const injected = selectFocusedRecords(ws, r.codes, 4, undefined, r.explicitCodes);
    expect(injected).toHaveLength(4);
    expect(injected.map((x) => x.airportCode)).toContain("DEN");
  });

  it("resolves the singular pronoun 'it' to the top of the focus stack", () => {
    const r = resolveFocus("why is it higher?", state({ focusStack: ["LAX", "SFO"] }));
    expect(r.codes).toEqual(["LAX"]);
  });

  it("resolves an ordinal against the last presented list", () => {
    const r = resolveFocus(
      "and the second one's unmet demand?",
      state({ lastPresentedList: ["LAX", "DEN", "SFO"], focusStack: ["DEN", "LAX", "SFO"] }),
    );
    expect(r.codes).toEqual(["DEN"]);
  });

  it("resolves 'last' to the final item of the last presented list", () => {
    const r = resolveFocus("what about the last one?", state({ lastPresentedList: ["LAX", "DEN", "SFO"] }));
    expect(r.codes).toEqual(["SFO"]);
  });

  it("resolves plural references to the whole last presented list", () => {
    const r = resolveFocus("compare them again", state({ lastPresentedList: ["LAX", "SFO"] }));
    expect(r.codes).toEqual(["LAX", "SFO"]);
  });

  it("flags ambiguity when a reference has nothing to resolve to", () => {
    expect(resolveFocus("why is that airport higher?", state()).ambiguous).toBe(true);
    expect(resolveFocus("and the second one?", state()).ambiguous).toBe(true);
    expect(resolveFocus("compare them", state()).ambiguous).toBe(true);
  });

  it("resolves '#2' and 'the last airport' as list references", () => {
    const s = state({ lastPresentedList: ["LAX", "DEN", "SFO"] });
    expect(resolveFocus("tell me more about #2", s).codes).toEqual(["DEN"]);
    expect(resolveFocus("what about the last airport?", s).codes).toEqual(["SFO"]);
  });

  it("does not treat 'last year' or 'top airports' as ordinal references", () => {
    const s = state({ lastPresentedList: ["LAX", "DEN"] });
    for (const msg of ["Is it the last year of data?", "show the top airports by congestion", "top congestion", "how did traffic grow in the first quarter?"]) {
      const r = resolveFocus(msg, s);
      expect(r.codes, msg).toEqual([]);
      expect(r.ambiguous, msg).toBe(false);
    }
  });

  it("does not treat 'all', 'these', 'that' or 'both X and Y' as list references", () => {
    const s = state({ lastPresentedList: ["LAX", "DEN"] });
    for (const msg of ["show me all airports with growth", "these numbers look high", "what does that mean?", "weigh both congestion and capacity"]) {
      const r = resolveFocus(msg, s);
      expect(r.codes, msg).toEqual([]);
      expect(r.ambiguous, msg).toBe(false);
    }
  });

  it("resolves plural references that name a list: 'those airports', 'both of them'", () => {
    const s = state({ lastPresentedList: ["LAX", "DEN"] });
    expect(resolveFocus("rank those airports by growth", s).codes).toEqual(["LAX", "DEN"]);
    expect(resolveFocus("are both of them congested?", s).codes).toEqual(["LAX", "DEN"]);
  });

  it("bare 'it' with nothing in focus is not flagged ambiguous (dummy subject)", () => {
    const r = resolveFocus("Is it possible to rank airports by delay?", state());
    expect(r.codes).toEqual([]);
    expect(r.ambiguous).toBe(false);
  });

  it("returns no codes for a general question with no entity or reference", () => {
    const r = resolveFocus("what does unmet demand mean?", state({ focusStack: ["LAX"] }));
    expect(r.codes).toEqual([]);
    expect(r.ambiguous).toBe(false);
  });

  it("caps the focus stack length", () => {
    const many = ["ATL", "LAX", "ORD", "DFW", "DEN", "SFO", "SEA", "MIA"];
    const r = resolveFocus("look at JFK", state({ focusStack: many }));
    expect(r.focusStack.length).toBeLessThanOrEqual(8);
    expect(r.focusStack[0]).toBe("JFK");
  });
});
