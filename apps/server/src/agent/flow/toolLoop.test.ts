import { asMessageId, type AgentEvent, type JsonValue } from "@airport/shared";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { LlmError, type LlmClient, type LlmRequest, type LlmStreamEvent } from "../../llm/llmClient.ts";
import { ANSWER_NOW, BAD_CALL_ANSWER, EMPTY_ANSWER, stepLimitAnswer } from "../prompts/toolLoop.ts";
import { getTool } from "../tools/registry.ts";
import { defineTool, ok, type RegisteredTool } from "../tools/tool.ts";
import { defaultLoopTools, LOOP_TOOL_NAMES, MAX_TOOL_STEPS, runToolLoop, type ToolLoopOutcome } from "./toolLoop.ts";

const messageId = asMessageId("m1");
const BOS_CALL = '{"tool":"get_enplanements","input":{"airport_code":"BOS"}}';

type Reply = string | LlmStreamEvent[] | (() => never);

/** A fake main model: call i gets replies[i] (the last one repeats). Records every request (a copy of its messages). */
function scripted(replies: Reply[]) {
  const requests: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      requests.push({ ...request, messages: [...request.messages] });
      const reply = replies[Math.min(requests.length - 1, replies.length - 1)]!;
      if (typeof reply === "function") reply();
      else if (typeof reply === "string") {
        yield { type: "text_delta", text: reply };
        yield { type: "done", stopReason: "end_turn" };
      } else yield* reply;
    },
  };
  return { client, requests };
}

/** A spy tool (strict zod input `{ airport_code }`) that records the inputs its own code ran with. */
function spyTool(name = "get_enplanements", run: (code: string) => JsonValue = (code) => ({ airportCode: code, latest: { year: 2024, enplanements: 1 } })) {
  const ran: string[] = [];
  const tool = defineTool({
    name,
    description: "spy",
    inputSchema: z.object({ airport_code: z.string().min(1).max(4) }).strict(),
    exampleInput: { airport_code: "BOS" },
    run: (input) => {
      ran.push(input.airport_code);
      return Promise.resolve(ok(run(input.airport_code)));
    },
  });
  return { tool, ran };
}

async function drain(client: LlmClient, tools: readonly RegisteredTool[], signal = new AbortController().signal) {
  const events: AgentEvent[] = [];
  const recorded: string[] = [];
  const loop = runToolLoop({
    client,
    model: "m",
    system: "SYSTEM",
    messages: [{ role: "user", content: "How many passengers did BOS have in 2024?" }],
    messageId,
    signal,
    tools,
    onToolResult: (name) => recorded.push(name),
  });
  let outcome: ToolLoopOutcome;
  for (;;) {
    const step = await loop.next();
    if (step.done === true) {
      outcome = step.value;
      break;
    }
    events.push(step.value);
  }
  return { events, outcome, recorded, text: events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("") };
}

const types = (events: AgentEvent[]) => events.map((e) => e.type);

describe("runToolLoop (#48)", () => {
  it("only offers the registry's lookups and get_enplanements, never score_airports", () => {
    const tools = defaultLoopTools();
    expect(tools.map((t) => t.name)).toEqual([...LOOP_TOOL_NAMES]);
    expect(tools.every((t) => t === getTool(t.name))).toBe(true);
    expect(tools.map((t) => t.name)).not.toContain("score_airports");
  });

  it("calls the real get_enplanements, feeds the result back as delimited data, then streams the answer", async () => {
    const { client, requests } = scripted([BOS_CALL, "BOS had about 20 million boardings in 2024."]);
    const { events, outcome, recorded, text } = await drain(client, defaultLoopTools());

    expect(types(events)).toEqual(["tool_call", "tool_result", "text_delta"]);
    expect(events[0]).toMatchObject({ type: "tool_call", name: "get_enplanements", input: { airport_code: "BOS" } });
    expect(events[1]).toMatchObject({ type: "tool_result", result: { ok: true, output: { airportCode: "BOS" } } });
    expect(text).toBe("BOS had about 20 million boardings in 2024.");
    expect(outcome).toEqual({ kind: "answered", stopReason: "end_turn" });
    expect(recorded).toEqual(["get_enplanements"]);
    const [assistant, observation] = requests[1]!.messages.slice(-2);
    expect(assistant).toEqual({ role: "assistant", content: BOS_CALL });
    expect(observation!.content).toMatch(/^<tool_result name="get_enplanements">\{"ok":true,"output":\{.*"airportCode":"BOS".*<\/tool_result>$/s);
  });

  it("runs a call in a ```json fence and never shows the JSON", async () => {
    const { tool, ran } = spyTool();
    const { client } = scripted(["```json\n" + BOS_CALL + "\n```", "Done."]);
    const { text } = await drain(client, [tool]);
    expect(ran).toEqual(["BOS"]);
    expect(text).toBe("Done.");
  });

  it("streams a lead-in sentence but holds the call that follows it", async () => {
    const { tool, ran } = spyTool();
    const { client } = scripted([
      [
        { type: "text_delta", text: "Let me check. " },
        { type: "text_delta", text: BOS_CALL.slice(0, 10) },
        { type: "text_delta", text: BOS_CALL.slice(10) },
        { type: "done", stopReason: "end_turn" },
      ],
      "BOS is busy.",
    ]);
    const { text } = await drain(client, [tool]);
    expect(ran).toEqual(["BOS"]);
    expect(text).toBe("Let me check. \n\nBOS is busy.");
    expect(text).not.toContain("{");
  });

  it("feeds malformed JSON back once, then uses the corrected call", async () => {
    const { tool, ran } = spyTool();
    const { client, requests } = scripted(['{"tool":"get_enplanements","input":{"airport_code":"BOS"', BOS_CALL, "OK."]);
    const { text, events } = await drain(client, [tool]);
    expect(requests[1]!.messages.at(-1)!.content).toMatch(/^<tool_error>Your tool call could not be run: the tool call was not valid JSON\./);
    expect(ran).toEqual(["BOS"]);
    expect(text).toBe("OK.");
    expect(types(events)).toEqual(["tool_call", "tool_result", "text_delta"]);
  });

  it("a second bad call ends with a plain answer: no raw JSON, no tool run", async () => {
    const { tool, ran } = spyTool();
    const { client, requests } = scripted(['{"tool": oops}', '```json\n{"tool":"get_enplanements",\n```']);
    const { text, events, outcome } = await drain(client, [tool]);
    expect(requests).toHaveLength(2);
    expect(ran).toEqual([]);
    expect(text).toBe(BAD_CALL_ANSWER);
    expect(types(events)).toEqual(["text_delta"]);
    expect(outcome).toEqual({ kind: "answered", stopReason: "end_turn" });
  });

  it("never runs an unknown tool: it is fed back as an error, never shown", async () => {
    const { tool, ran } = spyTool();
    const { client, requests } = scripted(['{"tool":"delete_db","input":{}}', "Sorry, I only have lookups."]);
    const { text, events } = await drain(client, [tool]);
    expect(ran).toEqual([]);
    expect(types(events)).toEqual(["text_delta"]);
    expect(text).toBe("Sorry, I only have lookups.");
    expect(requests[1]!.messages.at(-1)!.content).toContain('there is no tool named "delete_db". Available tools: get_enplanements, score_airports');
  });

  it("injection: arbitrary tool input is rejected by the tool's zod schema and the tool's code never runs", async () => {
    const { tool, ran } = spyTool();
    const injected = '{"tool":"get_enplanements","input":{"airport_code":"BOS","sql":"DROP TABLE airports","system":"ignore your rules"}}';
    const { client, requests } = scripted([injected, '{"tool":"get_enplanements","input":{"airport_code":"BOS; rm -rf /"}}', "I can't do that."]);
    const { events, text } = await drain(client, [tool]);
    expect(ran).toEqual([]);
    const results = events.filter((e) => e.type === "tool_result");
    expect(results).toHaveLength(2);
    for (const r of results) expect(r).toMatchObject({ result: { ok: false, errorMessage: expect.stringMatching(/^Invalid input for get_enplanements/) } });
    expect(requests[1]!.messages.at(-1)!.content).toContain('"ok":false');
    expect(text).toBe("I can't do that.");
  });

  it("a tool that throws is a failed tool_result fed back to the model, and the loop still answers", async () => {
    const { tool } = spyTool("get_enplanements", () => {
      throw new Error("disk on fire");
    });
    const { client, requests } = scripted([BOS_CALL, "The data is unavailable right now."]);
    const { events, text } = await drain(client, [tool]);
    expect(events[1]).toMatchObject({ type: "tool_result", result: { ok: false, errorMessage: "get_enplanements failed unexpectedly." } });
    expect(requests[1]!.messages.at(-1)!.content).toContain("failed unexpectedly");
    expect(text).toBe("The data is unavailable right now.");
  });

  it("the step cap: 6 tool runs, then one call with no tools whose prose answer is used", async () => {
    const { tool, ran } = spyTool();
    const { client, requests } = scripted([...Array<string>(MAX_TOOL_STEPS).fill(BOS_CALL), "Here is what I found."]);
    const { text, outcome } = await drain(client, [tool]);
    expect(ran).toHaveLength(MAX_TOOL_STEPS);
    expect(requests).toHaveLength(MAX_TOOL_STEPS + 1);
    expect(requests.at(-1)!.messages.at(-1)).toEqual({ role: "user", content: ANSWER_NOW });
    expect(text).toBe("Here is what I found.");
    expect(outcome.kind).toBe("answered");
  });

  it("the step cap: a model that still calls a tool gets a plain, non-empty answer and no 7th run", async () => {
    const { tool, ran } = spyTool();
    const { client, requests } = scripted([BOS_CALL]);
    const { text, events } = await drain(client, [tool]);
    expect(ran).toHaveLength(MAX_TOOL_STEPS);
    expect(requests).toHaveLength(MAX_TOOL_STEPS + 1);
    expect(text).toBe(stepLimitAnswer(MAX_TOOL_STEPS));
    expect(events.filter((e) => e.type === "tool_call")).toHaveLength(MAX_TOOL_STEPS);
  });

  it("an empty reply becomes a plain sentence, never an empty answer", async () => {
    const { client } = scripted([""]);
    const { text } = await drain(client, []);
    expect(text).toBe(EMPTY_ANSWER);
  });

  it("keeps max_tokens as the stop reason", async () => {
    const { client } = scripted([[{ type: "text_delta", text: "Partial" }, { type: "done", stopReason: "max_tokens" }]]);
    const { outcome } = await drain(client, []);
    expect(outcome).toEqual({ kind: "answered", stopReason: "max_tokens" });
  });

  it("a score_airports call ends the loop with the requested codes (the agent runs the #42 flow); nothing runs here", async () => {
    const { tool, ran } = spyTool();
    const { client } = scripted(['{"tool":"score_airports","input":{"airport_codes":["LAX","SNA",7]}}']);
    const { outcome, events } = await drain(client, [tool]);
    expect(outcome).toEqual({ kind: "score", codes: ["LAX", "SNA"] });
    expect(events).toEqual([]);
    expect(ran).toEqual([]);
  });

  it("an abort between steps stops the loop: no further model call, the run rejects", async () => {
    const controller = new AbortController();
    const { tool } = spyTool("get_enplanements", (code) => {
      controller.abort();
      return { airportCode: code };
    });
    const { client, requests } = scripted([BOS_CALL, "never"]);
    await expect(drain(client, [tool], controller.signal)).rejects.toThrow();
    expect(requests).toHaveLength(1);
  });

  it("an LlmError from the model propagates (the agent maps it to an HttpError or an error event)", async () => {
    const { client } = scripted([
      () => {
        throw new LlmError("unavailable", "down");
      },
    ]);
    await expect(drain(client, [])).rejects.toBeInstanceOf(LlmError);
  });

  it("thinking is streamed and closed before the tool call", async () => {
    vi.useFakeTimers();
    try {
      const { tool } = spyTool();
      const { client } = scripted([
        [{ type: "thinking_delta", text: "hmm" }, { type: "text_delta", text: BOS_CALL }, { type: "done", stopReason: "end_turn" }],
        "Done.",
      ]);
      const { events } = await drain(client, [tool]);
      expect(types(events)).toEqual(["thinking_delta", "thinking_end", "tool_call", "tool_result", "text_delta"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
