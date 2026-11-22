import { describe, expect, it } from "vitest";
import { extractExplicitCodes, resolveFocus } from "./focus.ts";
import type { AirportRecord, MemoryState } from "./types.ts";

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

  it("resolves city and region names via the gazetteer", () => {
    expect(extractExplicitCodes("add Denver to the comparison")).toEqual(["DEN"]);
    expect(extractExplicitCodes("look at the Bay Area")).toEqual(["SFO", "OAK", "SJC"]);
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
    expect(r.codes).toEqual(["LAX", "SFO", "DEN"]);
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

  it("flags ambiguity when a pronoun has nothing to resolve to", () => {
    const r = resolveFocus("why is it higher?", state());
    expect(r.codes).toEqual([]);
    expect(r.ambiguous).toBe(true);
  });

  it("returns no codes for a general question with no entity or reference", () => {
    const r = resolveFocus("what does unmet demand mean?", state({ focusStack: ["LAX"] }));
    expect(r.codes).toEqual([]);
    expect(r.ambiguous).toBe(false);
  });

  it("caps the focus stack length", () => {
    const many = ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG", "HHH"];
    const r = resolveFocus("look at JFK", state({ focusStack: many }));
    expect(r.focusStack.length).toBeLessThanOrEqual(8);
    expect(r.focusStack[0]).toBe("JFK");
  });
});
