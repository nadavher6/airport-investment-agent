import { asConversationId, type JsonValue } from "@airport/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineTool, ok } from "../tools/tool.ts";
import {
  cacheKey,
  ConversationMemory,
  DEFAULT_MAX_CONVERSATIONS,
  DEFAULT_MEMORY_TTL_MS,
  withMemory,
} from "./conversationMemory.ts";

const A = asConversationId("chat-a");
const B = asConversationId("chat-b");
const enplanements = (code: string): JsonValue => ({ airportCode: code, latestYear: 2024, enplanements: 1000 });
const score = (...codes: string[]): JsonValue => ({
  ranking: codes.map((airportCode, i) => ({ airportCode, score: 90 - 10 * i })),
  notFound: [],
});

/** A clock the test moves by hand. */
function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("ConversationMemory", () => {
  it("two different conversation ids never share memory", () => {
    const memory = new ConversationMemory();
    memory.session(A).record("get_enplanements", { airport_code: "LAX" }, enplanements("LAX"));
    memory.session(A).commit(["LAX"]);

    const b = memory.session(B).state();
    expect(b.workingSet.size).toBe(0);
    expect(b.focusStack).toEqual([]);
    expect(memory.session(B).cached("get_enplanements", { airport_code: "LAX" })).toBeUndefined();
    expect(memory.session(A).state().workingSet.has("LAX")).toBe(true);
  });

  it("uses the documented bounds by default: 200 conversations, 1 hour", () => {
    expect(DEFAULT_MAX_CONVERSATIONS).toBe(200);
    expect(DEFAULT_MEMORY_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("evicts the least recently used conversation past the size cap", () => {
    const memory = new ConversationMemory({ maxConversations: 2 });
    const ids = ["c1", "c2", "c3"].map(asConversationId);
    memory.session(ids[0]!).record("get_enplanements", { airport_code: "LAX" }, enplanements("LAX"));
    memory.session(ids[1]!).state();
    memory.session(ids[0]!).state(); // c1 is used again, so c2 is now the least recently used
    memory.session(ids[2]!).state();

    expect(memory.size).toBe(2);
    expect(memory.has(ids[1]!)).toBe(false);
    expect(memory.has(ids[0]!)).toBe(true);
    expect(memory.session(ids[0]!).state().workingSet.has("LAX")).toBe(true);
  });

  it("drops a conversation after the TTL with no turn, and a turn inside the TTL keeps it alive", () => {
    const c = clock();
    const memory = new ConversationMemory({ ttlMs: 1000, now: c.now });
    memory.session(A).record("get_enplanements", { airport_code: "LAX" }, enplanements("LAX"));
    memory.session(B).state();
    c.advance(800);
    memory.session(A).state(); // A is touched at t=800, B is not
    c.advance(500); // t=1300: B is 1300 ms idle, A 500 ms

    expect(memory.has(B)).toBe(false);
    expect(memory.has(A)).toBe(true);
    c.advance(1001);
    expect(memory.has(A)).toBe(false);
    expect(memory.session(A).state().workingSet.size).toBe(0); // an expired chat starts empty
    expect(memory.size).toBe(1); // B was evicted, A is a fresh entry
  });

  it("caps the airport records and the cached outputs of one conversation", () => {
    const memory = new ConversationMemory({ maxRecords: 2, maxCachedResults: 2 });
    const s = memory.session(A);
    for (const code of ["LAX", "SFO", "DEN"]) s.record("get_enplanements", { airport_code: code }, enplanements(code));

    expect([...s.state().workingSet.keys()]).toEqual(["SFO", "DEN"]);
    expect(s.cached("get_enplanements", { airport_code: "LAX" })).toBeUndefined();
    expect(s.cached("get_enplanements", { airport_code: "DEN" })).toEqual(enplanements("DEN"));
  });

  it("records score_airports per airport and caches it by its codes in any order and case", () => {
    const s = new ConversationMemory().session(A);
    expect(s.record("score_airports", { airport_codes: ["LAX", "SNA"] }, score("LAX", "SNA"))).toEqual(["LAX", "SNA"]);

    expect(s.state().workingSet.get("SNA")?.score).toMatchObject({ airportCode: "SNA", score: 80 });
    expect(s.cached("score_airports", { airport_codes: ["sna", " lax "] })).toEqual(score("LAX", "SNA"));
    expect(s.cached("score_airports", { airport_codes: ["LAX"] })).toBeUndefined();
  });

  it("keys the cache only by tool and airport codes, and only for a plain input", () => {
    expect(cacheKey("get_enplanements", { airport_code: "lax" })).toBe("get_enplanements:LAX");
    expect(cacheKey("score_airports", { airport_codes: ["SNA", "LAX", "lax"] })).toBe("score_airports:LAX,SNA");
    expect(cacheKey("get_enplanements", { airport_code: "LAX", extra: 1 })).toBeUndefined();
    expect(cacheKey("score_airports", { airport_codes: [] })).toBeUndefined();
    expect(cacheKey("find_airports_by_city", { city: "Boston" })).toBeUndefined();
  });

  it("commit moves the touched codes to the front of the focus stack and keeps the ranked list", () => {
    const s = new ConversationMemory().session(A);
    s.commit(["LAX"]);
    s.commit(["SNA", "LAX"], ["SNA", "LAX"]);
    expect(s.state().focusStack).toEqual(["SNA", "LAX"]);
    expect(s.state().lastPresentedList).toEqual(["SNA", "LAX"]);
  });
});

describe("withMemory", () => {
  const inputSchema = z.object({ airport_code: z.string() }).strict();

  it("runs the tool once; the same call again returns the cached output with no re-fetch", async () => {
    const run = vi.fn((input: { airport_code: string }) => Promise.resolve(ok(enplanements(input.airport_code))));
    const tool = defineTool({ name: "get_enplanements", description: "fake", inputSchema, exampleInput: { airport_code: "LAX" }, run });
    const session = new ConversationMemory().session(A);
    const seen: string[][] = [];
    const wrapped = withMemory(tool, session, (_name, _output, codes) => seen.push([...codes]));
    const ctx = { signal: new AbortController().signal };

    const first = await wrapped.run({ airport_code: "LAX" }, ctx);
    const second = await wrapped.run({ airport_code: "lax" }, ctx);

    expect(run).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(seen).toEqual([["LAX"], ["LAX"]]);
  });

  it("does not cache a failed run", async () => {
    const run = vi.fn(() => Promise.reject(new Error("boom")));
    const tool = defineTool({ name: "get_enplanements", description: "fake", inputSchema, exampleInput: { airport_code: "LAX" }, run });
    const wrapped = withMemory(tool, new ConversationMemory().session(A), () => undefined);
    const ctx = { signal: new AbortController().signal };

    expect((await wrapped.run({ airport_code: "LAX" }, ctx)).ok).toBe(false);
    expect((await wrapped.run({ airport_code: "LAX" }, ctx)).ok).toBe(false);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
