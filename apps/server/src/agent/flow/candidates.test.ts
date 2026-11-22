import { describe, expect, it, vi } from "vitest";
import { LlmError, type LlmClient } from "../../llm/llmClient.ts";
import { NO_CANDIDATES, parseCandidates, pickCandidates } from "./candidates.ts";

describe("parseCandidates (#42)", () => {
  it("accepts the strict shape, plain or in one ```json fence, trimming strings", () => {
    expect(parseCandidates('{"codes":[" LAX "],"cities":["Chicago"],"region":null}')).toEqual({ codes: ["LAX"], cities: ["Chicago"], region: null });
    expect(parseCandidates('```json\n{"codes":[],"cities":[],"region":"New England"}\n```')).toEqual({ codes: [], cities: [], region: "New England" });
  });

  it.each([
    ["prose", "LAX and SFO"],
    ["prose around JSON", 'Sure: {"codes":[],"cities":[],"region":null}'],
    ["a missing field", '{"codes":[],"cities":[]}'],
    ["an extra field", '{"codes":[],"cities":[],"region":null,"note":"x"}'],
    ["a string instead of a list", '{"codes":"LAX","cities":[],"region":null}'],
    ["an empty code", '{"codes":[""],"cities":[],"region":null}'],
    ["too many codes", JSON.stringify({ codes: Array(26).fill("LAX"), cities: [], region: null })],
    ["an array", "[]"],
  ])("rejects %s", (_name, raw) => {
    expect(parseCandidates(raw)).toBeUndefined();
  });
});

describe("pickCandidates", () => {
  it("a failed call falls back to no candidates (the turn still gets an answer)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client: LlmClient = {
      provider: "gemini",
      health: async () => ({ status: "ok", detail: "fake" }),
      // eslint-disable-next-line require-yield
      async *stream() {
        throw new LlmError("unavailable", "503");
      },
    };
    await expect(pickCandidates(client, [{ role: "user", content: "LAX?" }], new AbortController().signal)).resolves.toEqual({
      candidates: NO_CANDIDATES,
      attempts: 1,
      fallback: true,
    });
    vi.restoreAllMocks();
  });
});
