import { describe, expect, it } from "vitest";
import { extractExplicitCodes, resolveFocus } from "./focus.ts";
import { selectFocusedRecords } from "./assemble.ts";
import { findAirportsByCity, findAirportsByRegion } from "../../data/places/airports.ts";

/** The codes #23's city tool returns for one name: the single source of truth for places. */
const cityCodes = (city: string): string[] =>
  findAirportsByCity([city]).results[city]?.airports.map((a) => a.code) ?? [];
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

  it("an UPPERCASE word is a code only when get_airport_by_code confirms it", () => {
    expect(extractExplicitCodes("How does the FAA rank the USA hubs?")).toEqual([]);
    expect(extractExplicitCodes("What ROI would the CEO expect?")).toEqual([]);
    expect(extractExplicitCodes("Is ZZQ a hub?")).toEqual([]);
    expect(extractExplicitCodes("growth at DAY and SEA")).toEqual(["DAY", "SEA"]);
  });

  it("'per day' and other lowercase words without an airport cue give no code", () => {
    expect(extractExplicitCodes("how many passengers per day")).toEqual([]);
    expect(extractExplicitCodes("is the sun belt growing?")).toEqual([]);
    expect(extractExplicitCodes("I am far from sure, it is hot")).toEqual([]);
    expect(extractExplicitCodes("add bos")).toEqual([]);
  });

  it("'compare lax and sfo' gives LAX and SFO (compare cue + 'and' list)", () => {
    expect(extractExplicitCodes("compare lax and sfo")).toEqual(["LAX", "SFO"]);
    expect(extractExplicitCodes("compare lax and Sfo")).toEqual(["LAX", "SFO"]);
  });

  it("'what about den airport' gives DEN (airport cue)", () => {
    expect(extractExplicitCodes("what about den airport")).toEqual(["DEN"]);
  });

  it("lowercase codes after fly/flights cues, around 'vs', in a list with a confirmed code, or alone", () => {
    expect(extractExplicitCodes("cheap to fly to bos?")).toEqual(["BOS"]);
    expect(extractExplicitCodes("flights out of sea")).toEqual(["SEA"]);
    expect(extractExplicitCodes("flights from den to sfo")).toEqual(["DEN"]);
    expect(extractExplicitCodes("lax vs sfo")).toEqual(["LAX", "SFO"]);
    expect(extractExplicitCodes("LAX, sfo and den")).toEqual(["LAX", "SFO", "DEN"]);
    expect(extractExplicitCodes("lax?")).toEqual(["LAX"]);
    expect(extractExplicitCodes("lax, sfo and den")).toEqual([]);
  });

  it("'NYC' is not a code and goes to the city tool", () => {
    expect(extractExplicitCodes("NYC")).toEqual(cityCodes("NYC"));
    expect(extractExplicitCodes("NYC")).not.toContain("NYC");
  });

  it("scans a 60-word message in under 50 ms (median of 9 runs after warm-up)", () => {
    const msg =
      "I would like to understand which of these airports has the most unmet demand and whether the capacity " +
      "constraints at the busiest hubs justify a major expansion over the next decade given the growth in passenger " +
      "traffic and the congestion we have seen in recent years across the country especially in large metro areas " +
      "with several competing airports and limited land near Denver";
    expect(msg.split(" ").length).toBeGreaterThanOrEqual(60);
    for (let i = 0; i < 3; i++) extractExplicitCodes(msg);
    const runs: number[] = [];
    for (let i = 0; i < 9; i++) {
      const t = performance.now();
      extractExplicitCodes(msg);
      runs.push(performance.now() - t);
    }
    runs.sort((a, b) => a - b);
    // Limit 50 ms on the median: a warm run takes well under 1 ms, but a busy machine can stall one for a few ms.
    expect(runs[4]).toBeLessThan(50);
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
    const region = findAirportsByRegion("Pacific Northwest");
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
