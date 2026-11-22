import { asModelId, type AgentEvent, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmRequest } from "../llm/llmClient.ts";
import { fakeScoreAirports } from "../test/fakeScoreAirports.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";
import { CATEGORY_RULE, SCORING_RULE, buildToolLoopPrompt } from "./prompts/toolLoop.ts";
import { TOOLS } from "./tools/registry.ts";

const model: ModelInfo = {
  id: asModelId("claude-headless-model"),
  label: "Claude",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
};

/** Which category tool a question is about, by the words CATEGORY_RULE lists for it. */
const CATEGORY_WORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/congest|busy/i, "get_congestion"],
  [/load factor|unmet demand|turned.away/i, "get_unmet_demand"],
  [/long.haul|international/i, "get_long_haul_share"],
  [/growing|growth|trend/i, "get_growth"],
];

/**
 * A fake main model that follows the prompt: with both rules in its system prompt, an investment / "better" /
 * ranking question goes to score_airports (SCORING_RULE); a question about one category goes to that
 * category's tool (CATEGORY_RULE). Without the category rule it would score everything.
 */
function followsRules(request: LlmRequest): string {
  const last = request.messages.at(-1)!.content;
  if (last.startsWith("<tool_result")) return `Answered from ${/name="([a-z_]+)"/.exec(last)?.[1] ?? "?"}.`;
  const question = request.messages.filter((m) => m.role === "user").at(-1)!.content;
  const codes = question.match(/\b[A-Z]{3}\b/g) ?? [];
  const system = request.system ?? "";
  if (system.includes(SCORING_RULE) && /better|investment|rank/i.test(question)) {
    return JSON.stringify({ tool: "score_airports", input: { airport_codes: codes } });
  }
  const category = CATEGORY_WORDS.find(([re]) => re.test(question))?.[1];
  if (category !== undefined && system.includes(CATEGORY_RULE) && system.includes(`### ${category}\n`)) {
    return JSON.stringify({ tool: category, input: { airport_codes: codes } });
  }
  if (category !== undefined) return JSON.stringify({ tool: "score_airports", input: { airport_codes: codes } });
  return "I would guess.";
}

function client(): LlmClient {
  return {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) yield { type: "text_delta", text: JSON.stringify({ label: "in_scope", reason: "x" }) };
      else yield { type: "text_delta", text: followsRules(request) };
      yield { type: "done", stopReason: "end_turn" };
    },
  };
}

async function run(message: string) {
  const score = fakeScoreAirports();
  const c = client();
  const agent = new LlmPassthroughAgent({ "claude-headless": c, gemini: c }, undefined, { scoreAirports: score.tool, rng: () => 0 });
  const events = await collect(agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: message }] }, model, signal: new AbortController().signal }));
  return { events, score };
}

const calls = (events: AgentEvent[]) =>
  events.flatMap((e) => (e.type === "tool_call" && e.name !== "classify_message" ? [{ name: e.name, input: e.input }] : []));
const text = (events: AgentEvent[]) => events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("");

describe("the single-category rule (#61): prompt content", () => {
  const system = buildToolLoopPrompt(TOOLS, 6);

  it("keeps the owner's scoring rule word for word and puts the category rule right after it", () => {
    expect(system).toContain(`## Scoring rule\n${SCORING_RULE}\n\n${CATEGORY_RULE}`);
    expect(SCORING_RULE).toBe(
      "If the user asks about an airport's investment potential, or which airport is better / stronger / a better candidate / should be expanded (any comparison or ranking), you MUST call score_airports (max 5 codes; use the lookup tools first to find the codes) and base the answer on its result, explained with the compare skill. Never judge or rank airports from your own knowledge.",
    );
  });

  it("names each category's tool, says NOT score_airports, and keeps score_airports for investment / ranking", () => {
    expect(CATEGORY_RULE).toContain("call that category's tool, NOT score_airports, and answer only about that category");
    for (const name of ["get_congestion", "get_unmet_demand", "get_long_haul_share", "get_growth"]) {
      expect(CATEGORY_RULE).toContain(`-> ${name}`);
      expect(system).toContain(`### ${name}\n`);
    }
    expect(CATEGORY_RULE).toContain("Use score_airports only for overall investment potential, which airport is better, or a ranking");
    expect(CATEGORY_RULE).toContain('"How congested is JFK?" -> get_congestion([JFK])');
    expect(CATEGORY_RULE).toContain('"Is SFO\'s traffic growing?" -> get_growth([SFO])');
  });
});

describe("the single-category rule (#61): a fake model that follows the prompt", () => {
  it('"how congested is JFK?" calls get_congestion [JFK], not score_airports', async () => {
    const { events, score } = await run("how congested is JFK?");
    expect(calls(events)).toEqual([{ name: "get_congestion", input: { airport_codes: ["JFK"] } }]);
    expect(score.calls).toEqual([]);
    expect(events.find((e) => e.type === "tool_result" && e.result.ok && JSON.stringify(e.result.output).includes('"category":"congestion"'))).toBeDefined();
    expect(text(events)).toBe("Answered from get_congestion.");
  });

  it('"compare congestion at LAX and SFO" calls get_congestion [LAX, SFO]', async () => {
    const { events, score } = await run("compare congestion at LAX and SFO");
    expect(calls(events)).toEqual([{ name: "get_congestion", input: { airport_codes: ["LAX", "SFO"] } }]);
    expect(score.calls).toEqual([]);
  });

  it('"compare LAX and SNA congestion" calls get_congestion; score_airports is not called', async () => {
    const { events, score } = await run("compare LAX and SNA congestion");
    expect(calls(events).map((c) => c.name)).toEqual(["get_congestion"]);
    expect(score.calls).toEqual([]);
  });

  it('"what is LAX\'s load factor?" calls get_unmet_demand [LAX]', async () => {
    const { events } = await run("what is LAX's load factor?");
    expect(calls(events)).toEqual([{ name: "get_unmet_demand", input: { airport_codes: ["LAX"] } }]);
  });

  it('"is SFO growing" calls get_growth [SFO]', async () => {
    const { events, score } = await run("is SFO growing");
    expect(calls(events)).toEqual([{ name: "get_growth", input: { airport_codes: ["SFO"] } }]);
    expect(score.calls).toEqual([]);
  });

  it('"which is the better investment, LAX or SFO?" still calls score_airports', async () => {
    const { events, score } = await run("which is the better investment, LAX or SFO?");
    expect(calls(events).map((c) => c.name)).toEqual(["score_airports"]);
    expect(score.calls).toEqual([["LAX", "SFO"]]);
  });

  it('"which is better, LAX or SNA" still calls score_airports', async () => {
    const { events, score } = await run("which is better, LAX or SNA");
    expect(calls(events).map((c) => c.name)).toEqual(["score_airports"]);
    expect(score.calls).toEqual([["LAX", "SNA"]]);
  });
});
