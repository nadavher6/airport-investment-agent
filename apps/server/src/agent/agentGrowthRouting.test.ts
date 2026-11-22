import { asModelId, type AgentEvent, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmRequest } from "../llm/llmClient.ts";
import { fakeScoreAirports } from "../test/fakeScoreAirports.ts";
import { collect, finalAnswerJson, shownAnswer } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";
import { GROWTH_RULE, buildToolLoopPrompt } from "./prompts/toolLoop.ts";
import type { GrowthOutput } from "./tools/categoryTools.ts";
import { TOOLS } from "./tools/registry.ts";

const model: ModelInfo = {
  id: asModelId("claude-headless-model"),
  label: "Claude",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
};

const GROWTH_WORDS = /growth|growing|trend|traffic changed/i;

/** The fake's answer from a get_growth result: the trend in words, quoting a few facts exactly as the tool gave them. */
function explain(out: GrowthOutput): string {
  return out.airports
    .map((a) => {
      const g = a.growth;
      return (
        `${a.airportCode} traffic changed ${g.cagr5yr}% per year from 2019 to ${g.latest.year}, ` +
        `fell ${g.covid2020.pctVs2019}% in 2020 and is at ${g.recoveryVs2019} of its 2019 level.`
      );
    })
    .join(" ");
}

/** A fake main model that follows GROWTH_RULE when it is in the system prompt; else it would score the airport. */
function followsGrowthRule(request: LlmRequest): string {
  const last = request.messages.at(-1)!.content;
  const result = /^<tool_result name="get_growth">(.*)<\/tool_result>/s.exec(last);
  if (result) return finalAnswerJson(explain((JSON.parse(result[1]!) as { output: GrowthOutput }).output));
  if (last.startsWith("<tool_result")) return finalAnswerJson("Answered.");
  const question = request.messages.filter((m) => m.role === "user").at(-1)!.content;
  const codes = question.match(/\b[A-Z]{3}\b/g) ?? [];
  const system = request.system ?? "";
  const tool = GROWTH_WORDS.test(question) && system.includes(GROWTH_RULE) && system.includes("### get_growth\n") ? "get_growth" : "score_airports";
  return JSON.stringify({ tool, input: { airport_codes: codes } });
}

function client(): LlmClient {
  return {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) yield { type: "text_delta", text: JSON.stringify({ label: "in_scope", reason: "x" }) };
      else yield { type: "text_delta", text: followsGrowthRule(request) };
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
const growthOutput = (events: AgentEvent[]): GrowthOutput => {
  // The classifier's result comes first; get_growth's is the one with category "growth".
  const r = events.find((e) => e.type === "tool_result" && e.result.ok && JSON.stringify(e.result.output).includes('"category":"growth"'));
  if (r?.type !== "tool_result" || !r.result.ok) throw new Error("no tool result");
  return r.result.output as unknown as GrowthOutput;
};

describe("the growth rule (#67): prompt content", () => {
  const system = buildToolLoopPrompt(TOOLS, 6);
  const flat = GROWTH_RULE.replace(/\s+/g, " ");

  it("is a persona rule, after the answer-scope rule, once", () => {
    expect(system).toContain(`- ${GROWTH_RULE}\n`);
    expect(system.split("GROWTH QUESTIONS.")).toHaveLength(2);
    expect(system.indexOf("GROWTH QUESTIONS.")).toBeGreaterThan(system.indexOf("ANSWER THE SPECIFIC QUESTION"));
  });

  it("sends growth / trend / traffic-over-time questions to get_growth, not score_airports", () => {
    expect(flat).toContain('"show me the growth of X"');
    expect(flat).toContain('"how has X traffic changed"');
    expect(flat).toContain("call get_growth with the 1-5 codes (not score_airports, not get_enplanements)");
  });

  it("explains the trend without retyping the series: no yearly numbers or table, at most 3-4 exact numbers", () => {
    expect(flat).toContain("do NOT repeat the yearly numbers or put them in a table");
    expect(flat).toContain("Quote at most 3-4 key numbers, each copied exactly from the tool result");
    for (const fact of ["cagr5yr", "recoveryVs2019", "2020 COVID dip", "YoY", "durable vs. fragile demand", "9 periods"]) {
      expect(flat).toContain(fact);
    }
  });
});

describe("the growth rule (#67): a fake model that follows the prompt", () => {
  it('"show me the growth of BOS" calls get_growth [BOS], not score_airports; the answer has no table and only tool numbers', async () => {
    const { events, score } = await run("show me the growth of BOS");
    expect(calls(events)).toEqual([{ name: "get_growth", input: { airport_codes: ["BOS"] } }]);
    expect(score.calls).toEqual([]);
    const out = growthOutput(events);
    expect(out.airports[0]!.growth.series).toHaveLength(10);
    // The final answer (#63) is shown as the bold summary, then the markdown body: check the body.
    const shown = text(events);
    expect(shown.startsWith(shownAnswer(""))).toBe(true);
    const answer = shown.slice(shownAnswer("").length);
    expect(answer).toMatch(/^BOS traffic changed/);
    // No yearly table: no markdown table row, and no yearly enplanement figure is retyped.
    expect(answer).not.toMatch(/\|/);
    for (const p of out.airports[0]!.growth.series) if (p.enplanements !== null) expect(answer).not.toContain(String(p.enplanements));
    // Every number in the answer appears in the tool result.
    const wire = JSON.stringify(out);
    const numbers = answer.match(/-?\d+(\.\d+)?/g) ?? [];
    expect(numbers.length).toBeGreaterThan(0);
    for (const n of numbers) expect(wire).toContain(n);
  });

  it('"compare the growth of DEN and SFO" calls get_growth with both codes', async () => {
    const { events, score } = await run("compare the growth of DEN and SFO");
    expect(calls(events)).toEqual([{ name: "get_growth", input: { airport_codes: ["DEN", "SFO"] } }]);
    expect(score.calls).toEqual([]);
    expect(growthOutput(events).airports.map((a) => a.airportCode)).toEqual(["DEN", "SFO"]);
  });
});
