import type { AgentEventType, ChatRequest, ModelInfo } from "@airport/shared";
import { asModelId } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { collect } from "../test/helpers.ts";
import { MockAgent } from "./mockAgent.ts";

const request: ChatRequest = { modelId: asModelId("m"), messages: [{ role: "user", content: "Compare LAX and SNA" }] };

function model(thinking: boolean, toolUse: boolean): ModelInfo {
  return {
    id: asModelId("m"),
    label: "Test Model",
    provider: "gemini",
    description: "",
    capabilities: { thinking, toolUse },
    available: true,
  };
}

/** Collapses runs of the same event type: [a, a, b] -> [a, b]. */
const shape = (types: AgentEventType[]) => types.filter((t, i) => t !== types[i - 1]);

describe("MockAgent", () => {
  const agent = new MockAgent(0);

  it("emits thinking, a tool round-trip, then text, in protocol order", async () => {
    const events = await collect(agent.run({ request, model: model(true, true), signal: new AbortController().signal }));
    expect(shape(events.map((e) => e.type))).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_end",
      "tool_call",
      "tool_result",
      "text_delta",
      "message_end",
    ]);
  });

  it("uses one message id for every event and pairs the tool call with its result", async () => {
    const events = await collect(agent.run({ request, model: model(true, true), signal: new AbortController().signal }));
    const ids = new Set(events.map((e) => ("messageId" in e ? e.messageId : null)));
    expect(ids.size).toBe(1);

    const call = events.find((e) => e.type === "tool_call");
    const result = events.find((e) => e.type === "tool_result");
    expect(call && result && call.toolCallId === result.toolCallId).toBe(true);
    expect(call?.input).toMatchObject({ query: "Compare LAX and SNA" });
  });

  it("skips thinking and tools when the model lacks those capabilities", async () => {
    const events = await collect(agent.run({ request, model: model(false, false), signal: new AbortController().signal }));
    expect(shape(events.map((e) => e.type))).toEqual(["message_start", "text_delta", "message_end"]);
  });

  it("stops when the signal is aborted", async () => {
    const controller = new AbortController();
    const seen: string[] = [];
    const run = (async () => {
      for await (const event of new MockAgent(5).run({ request, model: model(true, true), signal: controller.signal })) {
        seen.push(event.type);
        if (seen.length === 3) controller.abort();
      }
    })();
    await expect(run).rejects.toThrow(/abort/i);
    expect(seen).not.toContain("message_end");
  });
});
