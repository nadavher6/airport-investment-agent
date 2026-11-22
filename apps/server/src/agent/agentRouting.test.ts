import { asModelId, type AgentEvent, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import type { LlmClient, LlmRequest } from "../llm/llmClient.ts";
import { fakeScoreAirports } from "../test/fakeScoreAirports.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { MAX_SCORED_AIRPORTS } from "./flow/resolve.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";
import { CANDIDATE_PROMPT } from "./prompts/candidates.ts";
import { GRADING_ANSWER_PROMPT } from "./prompts/grading.ts";
import { SCORE_ANSWER_PROMPT } from "./prompts/scoreAnswer.ts";
import { CAPABILITIES_ANSWER } from "./responses/capabilities.ts";
import { GREETING_ANSWER } from "./responses/greeting.ts";
import { OFF_TOPIC_SUGGESTIONS } from "./responses/offTopic.ts";

const model: ModelInfo = {
  id: asModelId("claude-headless-model"),
  label: "Claude",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
};

/** A fake client: the classifier says `label`, the candidate step says `candidate`, main calls get `mainReplies` in turn. */
function routeClient(label: string, candidate: string, mainReplies: string[] = ["Answer."]) {
  const main: LlmRequest[] = [];
  const candidates: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) yield { type: "text_delta", text: JSON.stringify({ label, reason: "x" }) };
      else if (request.system === CANDIDATE_PROMPT) {
        candidates.push(request);
        yield { type: "text_delta", text: candidate };
      } else {
        main.push(request);
        yield { type: "text_delta", text: mainReplies[Math.min(main.length - 1, mainReplies.length - 1)] ?? "" };
      }
      yield { type: "done", stopReason: "end_turn" };
    },
  };
  return { client, main, candidates };
}

const candidate = (intent: "score" | "lookup", codes: string[]) => JSON.stringify({ codes, cities: [], region: null, intent });

async function run(client: LlmClient, message: string) {
  const score = fakeScoreAirports();
  const agent = new LlmPassthroughAgent({ "claude-headless": client, gemini: client }, undefined, { scoreAirports: score.tool, rng: () => 0 });
  const events = await collect(agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: message }] }, model, signal: new AbortController().signal }));
  return { events, score };
}

const toolCalls = (events: AgentEvent[]) => events.flatMap((e) => (e.type === "tool_call" ? [e.name] : []));
const text = (events: AgentEvent[]) => events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("");

describe("agent routing (#47 routes kept, #48 loop for lookups)", () => {
  it.each([
    ["greeting", "hi", GREETING_ANSWER],
    ["capabilities", "what can you do?", CAPABILITIES_ANSWER],
  ])("%s: the fixed answer, no candidate step, no main call, no tools", async (label, message, answer) => {
    const { client, main, candidates } = routeClient(label, "");
    const { events } = await run(client, message);
    expect(text(events)).toBe(answer);
    expect(toolCalls(events)).toEqual(["classify_message"]);
    expect(main).toHaveLength(0);
    expect(candidates).toHaveLength(0);
  });

  it("off_topic: the fixed answer with a random suggestion, no main call", async () => {
    const { client, main } = routeClient("off_topic", "");
    const { events } = await run(client, "write me a poem");
    expect(text(events)).toContain(OFF_TOPIC_SUGGESTIONS[0]!);
    expect(main).toHaveLength(0);
  });

  it("grading: one main call with the grading skill, no candidate step, no tools", async () => {
    const { client, main, candidates } = routeClient("grading", "");
    const { events } = await run(client, "how do you score airports?");
    expect(candidates).toHaveLength(0);
    expect(main).toHaveLength(1);
    expect(main[0]!.system).toContain(GRADING_ANSWER_PROMPT);
    expect(toolCalls(events)).toEqual(["classify_message"]);
  });

  it('intent "score": the #42 flow scores the airports and answers with the score context; no tool loop', async () => {
    const { client, main } = routeClient("in_scope", candidate("score", ["LAX", "SNA"]));
    const { events, score } = await run(client, "compare LAX and SNA");
    expect(score.calls).toEqual([["LAX", "SNA"]]);
    expect(toolCalls(events)).toEqual(["classify_message", "pick_candidates", "get_airport_by_code", "get_airport_by_code", "score_airports"]);
    expect(main).toHaveLength(1);
    expect(main[0]!.system).toContain(SCORE_ANSWER_PROMPT);
    expect(main[0]!.system).not.toContain("## How to use tools");
  });

  it('intent "lookup": the tool loop runs get_enplanements, then answers; score_airports is not called', async () => {
    const { client, main } = routeClient("in_scope", candidate("lookup", ["ATL"]), [
      '{"tool":"get_enplanements","input":{"airport_code":"ATL"}}',
      "ATL had the most boardings in 2024.",
    ]);
    const { events, score } = await run(client, "How many passengers did ATL have in 2024?");
    expect(score.calls).toEqual([]);
    expect(toolCalls(events)).toEqual(["classify_message", "pick_candidates", "get_enplanements"]);
    expect(events.find((e) => e.type === "tool_result" && events.indexOf(e) > 4)).toMatchObject({ result: { ok: true, output: { airportCode: "ATL" } } });
    expect(text(events)).toBe("ATL had the most boardings in 2024.");
    expect(main[0]!.system).toContain("## How to use tools");
    expect(main[0]!.system).not.toContain("### score_airports");
    expect(events[0]?.type).toBe("message_start");
    expect(events.at(-1)).toMatchObject({ type: "message_end", stopReason: "end_turn" });
  });

  it("bad tool JSON in the loop never reaches the user", async () => {
    const { client } = routeClient("in_scope", candidate("lookup", []), ['```json\n{"tool":"get_enplanements","input":{"airport_code":', '{"tool": nope']);
    const { events } = await run(client, "How busy is ATL?");
    expect(text(events)).not.toMatch(/[{}`]|"tool"/);
    expect(text(events).length).toBeGreaterThan(0);
  });

  it("a loop that asks for score_airports goes to the #42 flow, which scores at most 5", async () => {
    const seven = ["LAX", "SFO", "SAN", "SJC", "OAK", "SMF", "BUR"];
    const { client, main } = routeClient("in_scope", candidate("lookup", []), [JSON.stringify({ tool: "score_airports", input: { airport_codes: seven } }), "Ranked."]);
    const { events, score } = await run(client, "rank the California airports");
    expect(score.calls).toHaveLength(1);
    expect(score.calls[0]!.length).toBeLessThanOrEqual(MAX_SCORED_AIRPORTS);
    expect(toolCalls(events).filter((n) => n === "score_airports")).toHaveLength(1);
    expect(main.at(-1)!.system).toContain(SCORE_ANSWER_PROMPT);
    expect(text(events)).toBe("Ranked.");
  });
});
