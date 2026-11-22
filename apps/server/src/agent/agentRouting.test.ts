import { asModelId, type AgentEvent, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmRequest } from "../llm/llmClient.ts";
import { fakeScoreAirports } from "../test/fakeScoreAirports.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { MAX_TOOL_STEPS } from "./flow/toolLoop.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";
import { GRADING_ANSWER_PROMPT } from "./prompts/grading.ts";
import { SCORING_RULE, stepLimitAnswer } from "./prompts/toolLoop.ts";
import { GRACEFUL_FALLBACK } from "./toolGuard.ts";
import { CAPABILITIES_ANSWER } from "./responses/capabilities.ts";
import { GREETING_ANSWER } from "./responses/greeting.ts";
import { OFF_TOPIC_SUGGESTIONS } from "./responses/offTopic.ts";
import { COMPARE_SKILL } from "./skills/compare.ts";

const model: ModelInfo = {
  id: asModelId("claude-headless-model"),
  label: "Claude",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
};

type MainModel = (request: LlmRequest, call: number) => string;

/** A fake client: the classifier says `label`; main (tool loop) calls are answered by `main`. */
function routeClient(label: string, main: MainModel = () => "Answer.") {
  const seen: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) yield { type: "text_delta", text: JSON.stringify({ label, reason: "x" }) };
      else {
        seen.push({ ...request, messages: [...request.messages] });
        yield { type: "text_delta", text: main(request, seen.length - 1) };
      }
      yield { type: "done", stopReason: "end_turn" };
    },
  };
  return { client, seen };
}

/** Replies in order (the last one repeats). */
const replies = (...texts: string[]): MainModel => (_request, call) => texts[Math.min(call, texts.length - 1)]!;

/**
 * A fake model that follows the scoring rule: when the rule is in its system prompt and the question asks
 * which airport is better or about investment, it scores the codes named in the question, then answers.
 */
const followsScoringRule: MainModel = (request) => {
  const last = request.messages.at(-1)!.content;
  if (last.startsWith("<tool_result")) return "Explained with the compare skill.";
  const question = request.messages.filter((m) => m.role === "user").at(-1)!.content;
  if (request.system?.includes(SCORING_RULE) && /better|investment/i.test(question)) {
    return JSON.stringify({ tool: "score_airports", input: { airport_codes: question.match(/\b[A-Z]{3}\b/g) ?? [] } });
  }
  return "I would guess.";
};

async function run(client: LlmClient, message: string) {
  const score = fakeScoreAirports();
  const agent = new LlmPassthroughAgent({ "claude-headless": client, gemini: client }, undefined, { scoreAirports: score.tool, rng: () => 0 });
  const events = await collect(agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: message }] }, model, signal: new AbortController().signal }));
  return { events, score };
}

const toolCalls = (events: AgentEvent[]) => events.flatMap((e) => (e.type === "tool_call" ? [e.name] : []));
const text = (events: AgentEvent[]) => events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("");

describe("agent routing (#48): classifier first, fixed answers, everything else in the ReAct loop", () => {
  it.each([
    ["greeting", "hi", GREETING_ANSWER],
    ["capabilities", "what can you do?", CAPABILITIES_ANSWER],
  ])("%s: the fixed answer, no main call, no tools", async (label, message, answer) => {
    const { client, seen } = routeClient(label);
    const { events } = await run(client, message);
    expect(text(events)).toBe(answer);
    expect(toolCalls(events)).toEqual(["classify_message"]);
    expect(seen).toHaveLength(0);
  });

  it("off_topic: the fixed answer with a random suggestion, no main call", async () => {
    const { client, seen } = routeClient("off_topic");
    const { events } = await run(client, "write me a poem");
    expect(text(events)).toContain(OFF_TOPIC_SUGGESTIONS[0]!);
    expect(seen).toHaveLength(0);
  });

  it("grading: the tool loop, with the grading skill in its system prompt", async () => {
    const { client, seen } = routeClient("grading");
    const { events } = await run(client, "how do you score airports?");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.system).toContain("## How to use tools");
    expect(seen[0]!.system).toContain(GRADING_ANSWER_PROMPT);
    expect(text(events)).toBe("Answer.");
  });

  it("in_scope: the loop's prompt has all registry tools, the owner's scoring rule verbatim and the compare skill; no grading skill", async () => {
    const { client, seen } = routeClient("in_scope");
    await run(client, "How busy is ATL?");
    const system = seen[0]!.system!;
    for (const name of ["get_airport_by_code", "find_airports_by_city", "find_airports_by_region", "get_enplanements", "score_airports"]) {
      expect(system).toContain(`### ${name}\n`);
    }
    expect(system).toContain(
      "If the user asks about an airport's investment potential, or which airport is better / stronger / a better candidate / should be expanded (any comparison or ranking), you MUST call score_airports (max 5 codes; use the lookup tools first to find the codes) and base the answer on its result, explained with the compare skill. Never judge or rank airports from your own knowledge.",
    );
    expect(system).toContain("how to compare and format when score_airports returns 2-5 airports");
    expect(system).toContain(COMPARE_SKILL);
    expect(system).not.toContain(GRADING_ANSWER_PROMPT);
  });

  it('"which is better, LAX or SNA?": the loop calls score_airports with LAX and SNA', async () => {
    const { client } = routeClient("in_scope", followsScoringRule);
    const { events, score } = await run(client, "which is better, LAX or SNA?");
    expect(score.calls).toEqual([["LAX", "SNA"]]);
    expect(toolCalls(events)).toEqual(["classify_message", "score_airports"]);
    expect(text(events)).toBe("Explained with the compare skill.");
  });

  it('"is DEN a good investment?": the loop calls score_airports with [DEN]', async () => {
    const { client } = routeClient("in_scope", followsScoringRule);
    const { score } = await run(client, "is DEN a good investment?");
    expect(score.calls).toEqual([["DEN"]]);
  });

  it("get_enplanements -> answer, in README order", async () => {
    const { client } = routeClient("in_scope", replies('{"tool":"get_enplanements","input":{"airport_code":"ATL"}}', "ATL had the most boardings in 2024."));
    const { events, score } = await run(client, "How many passengers did ATL have in 2024?");
    expect(score.calls).toEqual([]);
    expect(events.map((e) => e.type)).toEqual(["message_start", "tool_call", "tool_result", "tool_call", "tool_result", "text_delta", "message_end"]);
    expect(events[4]).toMatchObject({ result: { ok: true, output: { airportCode: "ATL" } } });
    expect(text(events)).toBe("ATL had the most boardings in 2024.");
  });

  it("the step cap ends with a non-empty answer", async () => {
    const codes = ["ATL", "BOS", "LAX", "SFO", "JFK", "ORD", "SEA", "DEN"];
    const { client, seen } = routeClient("in_scope", (_request, call) =>
      JSON.stringify({ tool: "get_enplanements", input: { airport_code: codes[call] ?? "DFW" } }),
    );
    const { events } = await run(client, "ATL?");
    expect(seen).toHaveLength(MAX_TOOL_STEPS + 1);
    expect(text(events)).toBe(stepLimitAnswer(MAX_TOOL_STEPS));
    expect(events.at(-1)).toMatchObject({ type: "message_end" });
  });

  it("the same call over and over is a repeat_call (#49) and ends with a plain answer", async () => {
    const { client, seen } = routeClient("in_scope", replies('{"tool":"get_enplanements","input":{"airport_code":"ATL"}}'));
    const { events } = await run(client, "ATL?");
    // 1 run, then 3 repeat_call attempts (the first + 2 retries), then the no-tools call.
    expect(events.filter((e) => e.type === "tool_call" && e.name !== "classify_message")).toHaveLength(4);
    expect(seen).toHaveLength(5);
    expect(seen[2]!.messages.at(-1)!.content).toContain("code: repeat_call");
    expect(text(events)).toBe(GRACEFUL_FALLBACK);
    expect(events.at(-1)).toMatchObject({ type: "message_end" });
  });

  it("bad tool JSON never reaches the user", async () => {
    const { client } = routeClient("in_scope", replies('```json\n{"tool":"get_enplanements","input":{"airport_code":', '{"tool": nope'));
    const { events } = await run(client, "How busy is ATL?");
    expect(text(events)).not.toMatch(/[{}`]|"tool"/);
    expect(text(events).length).toBeGreaterThan(0);
  });
});
