import { asModelId, type AgentEvent, type ModelInfo, type ModelProvider } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { type LlmClient, type LlmStreamEvent } from "../llm/llmClient.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { ToolAgent } from "./toolAgent.ts";

const modelOf = (provider: ModelProvider): ModelInfo => ({
  id: asModelId(`${provider}-model`),
  label: provider,
  provider,
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
});

const chunks = (text: string): LlmStreamEvent[] => [
  { type: "text_delta", text },
  { type: "done", stopReason: "end_turn" },
];

/** Fake client: the classifier call gets `classifierReply`; each later (main) call pops the next script entry. */
function fakeClient(mainReplies: string[], classifierReply = '{"label":"in_scope","reason":"airport question"}') {
  const queue = [...mainReplies];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) {
        yield* chunks(classifierReply);
        return;
      }
      yield* chunks(queue.shift() ?? "No more scripted replies.");
    },
  };
  return client;
}

const run = (client: LlmClient, lastMessage = "How has BOS passenger traffic changed?") => {
  const unused: LlmClient = {
    provider: "gemini",
    health: async () => ({ status: "ok", detail: "unused" }),
    stream: () => {
      throw new Error("wrong provider");
    },
  };
  const agent = new ToolAgent({ "claude-headless": client, gemini: unused });
  const model = modelOf("claude-headless");
  return collect(
    agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: lastMessage }] }, model, signal: new AbortController().signal }),
  );
};

const types = (events: AgentEvent[]) => events.map((e) => e.type);
const find = <T extends AgentEvent["type"]>(events: AgentEvent[], t: T) => events.filter((e) => e.type === t);

describe("ToolAgent", () => {
  it("runs a tool the model asks for, shows it as tool_call/tool_result, then answers", async () => {
    const events = await run(
      fakeClient([
        '{"tool": "get_enplanements", "input": {"airport_code": "BOS"}}', // step 1: call the tool
        "Boston (BOS) handled about 15M enplanements in the latest year.", // step 2: final answer
      ]),
    );

    // message_start first; classify step shown; then the get_enplanements tool step; then text; then end.
    expect(types(events)[0]).toBe("message_start");
    const toolCalls = find(events, "tool_call");
    expect(toolCalls.map((e) => (e as { name: string }).name)).toEqual(["classify_message", "get_enplanements"]);

    const getEnp = toolCalls.find((e) => (e as { name: string }).name === "get_enplanements") as { input: unknown };
    expect(getEnp.input).toEqual({ airport_code: "BOS" });

    // the tool actually ran against real data -> a successful result with a real figure
    const results = find(events, "tool_result");
    const enpResult = results[1] as { result: { ok: boolean; output?: { airportCode?: string } } };
    expect(enpResult.result.ok).toBe(true);
    expect(enpResult.result.output?.airportCode).toBe("BOS");

    const text = find(events, "text_delta").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toContain("Boston");
    expect(types(events).at(-1)).toBe("message_end");
  });

  it("answers directly when the model does not call a tool", async () => {
    const events = await run(fakeClient(["Terminal expansion pays off where airports are congested and growing."]));
    // only the classifier tool step, no extra tool calls
    expect(find(events, "tool_call").map((e) => (e as { name: string }).name)).toEqual(["classify_message"]);
    const text = find(events, "text_delta").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toContain("Terminal expansion");
  });

  it("gives the fixed capabilities answer without calling the main LLM or any tool", async () => {
    const events = await run(
      fakeClient(["SHOULD NOT BE USED"], '{"label":"capabilities","reason":"asks what it can do"}'),
      "what can you do?",
    );
    expect(find(events, "tool_call").map((e) => (e as { name: string }).name)).toEqual(["classify_message"]);
    const text = find(events, "text_delta").map((e) => (e as { delta: string }).delta).join("");
    expect(text).toContain("airport investment research assistant");
  });
});
