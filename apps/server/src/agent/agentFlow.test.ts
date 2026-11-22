import { asMessageId, asModelId, type AgentEvent, type ModelInfo } from "@airport/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LlmClient, LlmRequest } from "../llm/llmClient.ts";
import { MODELS } from "../llm/models.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { fakeScoreAirports } from "./flow/fakeScoreAirports.ts";
import { MAX_SCORED_AIRPORTS, registryLookupTools, resolveCandidates } from "./flow/resolve.ts";
import { defaultScoreAirportsTool } from "./flow/scoreAirports.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";
import { CANDIDATE_PROMPT } from "./prompts/candidates.ts";
import { GRADING_ANSWER_PROMPT } from "./prompts/grading.ts";
import { NO_CANDIDATES_PROMPT, SCORE_ANSWER_PROMPT, SCORE_FAILED_PROMPT } from "./prompts/scoreAnswer.ts";
import { COMPARE_SKILL } from "./skills/compare.ts";
import { GRADING_SKILL } from "./skills/grading.ts";
import { getTool } from "./tools/registry.ts";

const model: ModelInfo = {
  id: asModelId("claude-headless-model"),
  label: "Claude",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
};

/** A fake client: the classifier gets `label`, the candidate step gets `candidateReplies` in turn, the main call "Answer.". */
function flowClient(label: string, candidateReplies: string[], onMain?: () => void) {
  const main: LlmRequest[] = [];
  const candidates: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) {
        yield { type: "text_delta", text: JSON.stringify({ label, reason: "x" }) };
      } else if (request.system === CANDIDATE_PROMPT) {
        candidates.push(request);
        yield { type: "text_delta", text: candidateReplies[Math.min(candidates.length - 1, candidateReplies.length - 1)] ?? "" };
      } else {
        main.push(request);
        onMain?.();
        yield { type: "text_delta", text: "Answer." };
      }
      yield { type: "done", stopReason: "end_turn" };
    },
  };
  return { client, main, candidates };
}

const json = (codes: string[], cities: string[] = [], region: string | null = null) => JSON.stringify({ codes, cities, region });

function runFlow(client: LlmClient, message: string, score = fakeScoreAirports(), signal = new AbortController().signal) {
  const agent = new LlmPassthroughAgent({ "claude-headless": client, gemini: client }, undefined, { scoreAirports: score.tool });
  return collect(agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: message }] }, model, signal }));
}

/** The tool names of the tool_call events, in order. */
const toolCalls = (events: AgentEvent[]): string[] => events.flatMap((e) => (e.type === "tool_call" ? [e.name] : []));

afterEach(() => vi.restoreAllMocks());

describe("agent flow: in_scope -> candidates -> lookups -> score_airports -> answer (#42)", () => {
  it('"compare LAX and SFO": score_airports gets exactly [LAX, SFO], events stream in order, results go in the system context', async () => {
    const { client, main, candidates } = flowClient("in_scope", [json(["LAX", "SFO"])]);
    const score = fakeScoreAirports();
    const events = await runFlow(client, "compare LAX and SFO", score);

    expect(score.calls).toEqual([["LAX", "SFO"]]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.model).toBe(MODELS["claude-headless"].classifier);
    expect(events.map((e) => e.type)).toEqual([
      "message_start",
      ...Array<string>(5).fill("tool_call|tool_result").flatMap((p) => p.split("|")),
      "text_delta",
      "message_end",
    ]);
    expect(toolCalls(events)).toEqual(["classify_message", "pick_candidates", "get_airport_by_code", "get_airport_by_code", "score_airports"]);
    // Each tool_result follows its own tool_call.
    for (let i = 1; i < events.length - 2; i += 2) {
      const [call, result] = [events[i], events[i + 1]];
      expect(call?.type === "tool_call" && result?.type === "tool_result" && call.toolCallId === result.toolCallId).toBe(true);
    }
    expect(events[4]).toMatchObject({ type: "tool_result", result: { ok: true, output: { codes: ["LAX", "SFO"], attempts: 1, fallback: false } } });
    expect(events.at(-3)).toMatchObject({ type: "tool_result", result: { ok: true, output: { mode: "relative" } } });

    // One main call, with the results in its system context (not in the dialogue).
    expect(main).toHaveLength(1);
    expect(main[0]!.model).toBe(MODELS["claude-headless"].main);
    expect(main[0]!.system).toContain(SCORE_ANSWER_PROMPT);
    expect(main[0]!.system).toContain('"airportCode":"LAX"');
    expect(main[0]!.system).toContain('"airportCode":"SFO"');
    expect(main[0]!.messages).toEqual([{ role: "user", content: "compare LAX and SFO" }]);
  });

  it('"strong candidates in New England": the region resolves, the 5 busiest of 6 are scored and the answer is told so', async () => {
    const { client, main } = flowClient("in_scope", [json([], [], "New England")]);
    const score = fakeScoreAirports();
    const events = await runFlow(client, "strong candidates in New England", score);
    expect(toolCalls(events)).toEqual(["classify_message", "pick_candidates", "find_airports_by_region", "score_airports"]);
    // BOS, BDL, PVD, PWM, BTV by latest enplanements; MHT (the 6th) is dropped.
    expect(score.calls).toEqual([["BOS", "BDL", "PVD", "PWM", "BTV"]]);
    expect(main[0]!.system).toContain("showing the 5 busiest of 6");
  });

  it("resolves cities through find_airports_by_city", async () => {
    const { client } = flowClient("in_scope", [json([], ["Chicago"])]);
    const score = fakeScoreAirports();
    const events = await runFlow(client, "airports in Chicago", score);
    expect(toolCalls(events)).toEqual(["classify_message", "pick_candidates", "find_airports_by_city", "score_airports"]);
    expect(score.calls).toEqual([["ORD", "MDW"]]);
  });

  it("an invalid candidate JSON gets one retry with the previous answer, then falls back to no candidates", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, main, candidates } = flowClient("in_scope", ["Sure! LAX and SFO.", '{"codes":"LAX"}']);
    const score = fakeScoreAirports();
    const events = await runFlow(client, "compare LAX and SFO", score);
    expect(candidates).toHaveLength(2);
    expect(candidates[1]!.messages[0]!.content).toContain("Sure! LAX and SFO.");
    expect(events[4]).toMatchObject({ result: { ok: true, output: { codes: [], attempts: 2, fallback: true } } });
    expect(score.calls).toEqual([]);
    expect(main[0]!.system).toBe(NO_CANDIDATES_PROMPT);
  });

  it("a valid retry is used", async () => {
    const { client } = flowClient("in_scope", ["not json", json(["DEN"])]);
    const score = fakeScoreAirports();
    await runFlow(client, "is DEN growing?", score);
    expect(score.calls).toEqual([["DEN"]]);
  });

  it("drops unknown codes and tells the answer", async () => {
    const { client, main } = flowClient("in_scope", [json(["LAX", "ZZZ", "lax"])]);
    const score = fakeScoreAirports();
    await runFlow(client, "compare LAX and ZZZ", score);
    expect(score.calls).toEqual([["LAX"]]);
    expect(main[0]!.system).toContain("were dropped: ZZZ");
  });

  it("no candidates: score_airports is not called and the answer says no airport was identified", async () => {
    const { client, main } = flowClient("in_scope", [json([])]);
    const score = fakeScoreAirports();
    const events = await runFlow(client, "which US airports are the most congested?", score);
    expect(score.calls).toEqual([]);
    expect(toolCalls(events)).toEqual(["classify_message", "pick_candidates"]);
    expect(main[0]!.system).toBe(NO_CANDIDATES_PROMPT);
  });

  it("a failing score_airports is a plain-English tool_result, and the answer continues without scores", async () => {
    const { client, main } = flowClient("in_scope", [json(["LAX"])]);
    const events = await runFlow(client, "score LAX", fakeScoreAirports("The scoring data is unavailable."));
    expect(events.at(-3)).toMatchObject({ type: "tool_result", result: { ok: false, errorMessage: "The scoring data is unavailable." } });
    expect(events.at(-1)).toMatchObject({ type: "message_end" });
    expect(main[0]!.system).toContain(SCORE_FAILED_PROMPT);
    expect(main[0]!.system).toContain("The scoring data is unavailable.");
  });

  it("an abort mid-flow (during score_airports) stops everything: no main call, the run rejects", async () => {
    const controller = new AbortController();
    const { client, main } = flowClient("in_scope", [json(["LAX", "SFO"])]);
    const score = fakeScoreAirports();
    const aborting = { ...score.tool, run: async (...args: Parameters<typeof score.tool.run>) => {
      controller.abort(new Error("Stop pressed"));
      return score.tool.run(...args);
    } };
    const agent = new LlmPassthroughAgent({ "claude-headless": client, gemini: client }, undefined, { scoreAirports: aborting });
    const run = collect(agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: "compare LAX and SFO" }] }, model, signal: controller.signal }));
    await expect(run).rejects.toThrow("Stop pressed");
    expect(main).toHaveLength(0);
  });

  it("an abort during the candidate step stops before any tool", async () => {
    const controller = new AbortController();
    const { client, main } = flowClient("in_scope", [json(["LAX"])]);
    const stream = client.stream.bind(client);
    const aborting: LlmClient = { ...client, stream: (request) => {
      if (request.system === CANDIDATE_PROMPT) controller.abort(new Error("Stop pressed"));
      return stream(request);
    } };
    const score = fakeScoreAirports();
    await expect(runFlow(aborting, "score LAX", score, controller.signal)).rejects.toThrow("Stop pressed");
    expect(score.calls).toEqual([]);
    expect(main).toHaveLength(0);
  });

  it("uses the real registered score_airports by default (PR #38)", () => {
    expect(defaultScoreAirportsTool()).toBe(getTool("score_airports"));
  });
});

describe("never more than 5 codes reach score_airports (property test)", () => {
  /** A small seeded PRNG (mulberry32), so the property test is reproducible. */
  const seeded = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const CODES = ["LAX", "SFO", "JFK", "ATL", "ORD", "DEN", "DFW", "SEA", "BOS", "MIA", "ZZZ", "lax", "SNA", "PDX", "PHX"];
  const CITIES = ["New York", "Chicago", "Bay Area", "Houston", "Nowhere", "Los Angeles"];
  const REGIONS = ["New England", "West Coast", "Midwest", "Atlantis", null];

  it("holds for 200 random candidate sets", async () => {
    const rng = seeded(42);
    const some = <T,>(list: readonly T[]): T[] => list.filter(() => rng() < 0.35);
    const tools = registryLookupTools();
    for (let i = 0; i < 200; i++) {
      const candidates = { codes: some(CODES), cities: some(CITIES), region: REGIONS[Math.floor(rng() * REGIONS.length)] ?? null };
      const resolution = await resolveCandidates(candidates, tools, asMessageId(`m${i}`), new AbortController().signal);
      expect(resolution.codes.length).toBeLessThanOrEqual(MAX_SCORED_AIRPORTS);
      expect(new Set(resolution.codes).size).toBe(resolution.codes.length);
      expect(resolution.total).toBeGreaterThanOrEqual(resolution.codes.length);
    }
  });

  it("6+ named codes keep the 5 busiest of them", async () => {
    const resolution = await resolveCandidates(
      { codes: ["SNA", "LAX", "ATL", "PDX", "DEN", "DFW"], cities: [], region: null },
      registryLookupTools(),
      asMessageId("m"),
      new AbortController().signal,
    );
    expect(resolution.codes).toHaveLength(5);
    expect(resolution.codes).not.toContain("SNA");
    expect(resolution.total).toBe(6);
  });
});

describe("compare skill in the answer context (#46)", () => {
  it.each([
    [2, ["LAX", "SFO"]],
    [3, ["LAX", "SFO", "SEA"]],
    [5, ["LAX", "SFO", "SEA", "PDX", "SAN"]],
  ])("is loaded for %i scored airports", async (_n, codes) => {
    const { client, main } = flowClient("in_scope", [json(codes)]);
    await runFlow(client, "compare them");
    expect(main[0]!.system).toContain(COMPARE_SKILL);
  });

  it("is not loaded for 1 scored airport", async () => {
    const { client, main } = flowClient("in_scope", [json(["LAX"])]);
    await runFlow(client, "score LAX");
    expect(main[0]!.system).toContain(SCORE_ANSWER_PROMPT);
    expect(main[0]!.system).not.toContain(COMPARE_SKILL);
  });

  it("is not loaded with 0 airports (no tool, no skill)", async () => {
    const { client, main } = flowClient("in_scope", [json([])]);
    const score = fakeScoreAirports();
    await runFlow(client, "which airports are congested?", score);
    expect(score.calls).toEqual([]);
    expect(main[0]!.system).not.toContain(COMPARE_SKILL);
  });
});

describe("grading flow (#43)", () => {
  it("grading: no candidate step, no tool, one main call with the grading skill in its system context", async () => {
    const { client, main, candidates } = flowClient("grading", [json(["LAX"])]);
    const score = fakeScoreAirports();
    const events = await runFlow(client, "How do you score airports?", score);
    expect(candidates).toHaveLength(0);
    expect(score.calls).toEqual([]);
    expect(toolCalls(events)).toEqual(["classify_message"]);
    expect(events[2]).toMatchObject({ type: "tool_result", result: { ok: true, output: { label: "grading" } } });
    expect(main).toHaveLength(1);
    expect(main[0]!.model).toBe(MODELS["claude-headless"].main);
    expect(main[0]!.system).toContain(GRADING_ANSWER_PROMPT);
    expect(main[0]!.system).toContain(GRADING_SKILL);
    expect(main[0]!.system).not.toContain(COMPARE_SKILL);
  });
});
