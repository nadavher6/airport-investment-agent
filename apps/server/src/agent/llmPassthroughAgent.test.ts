import { asModelId, type ModelInfo, type ModelProvider } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient, type LlmRequest, type LlmStreamEvent } from "../llm/llmClient.ts";
import { collect } from "../test/helpers.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";

const modelOf = (provider: ModelProvider): ModelInfo => ({
  id: asModelId(`${provider}-model`),
  label: provider,
  provider,
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
});

/** A fake LlmClient that replays events, then optionally throws. Records what it was sent. */
function fakeClient(events: LlmStreamEvent[], failWith?: LlmError) {
  const seen: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      seen.push(request);
      yield* events;
      if (failWith) throw failWith;
    },
  };
  return { client, seen };
}

/** A client that must not be called: the passthrough should pick the other provider's client. */
const unused: LlmClient = {
  provider: "gemini",
  health: async () => ({ status: "ok", detail: "unused" }),
  stream: () => {
    throw new Error("the wrong provider's client was called");
  },
};

const runWith = (client: LlmClient, provider: ModelProvider = "claude-headless") => {
  const clients: Record<ModelProvider, LlmClient> = { "claude-headless": unused, gemini: unused };
  clients[provider] = client;
  const agent = new LlmPassthroughAgent(clients);
  const history = [
    { role: "user" as const, content: "Rank SFO" },
    { role: "assistant" as const, content: "It is busy." },
    { role: "user" as const, content: "And LAX?" },
  ];
  return collect(agent.run({ request: { modelId: modelOf(provider).id, messages: history }, model: modelOf(provider), signal: new AbortController().signal }));
};

describe("LlmPassthroughAgent", () => {
  it("maps the client stream to message_start, thinking, thinking_end, text and message_end, in README order", async () => {
    const { client, seen } = fakeClient([
      { type: "thinking_delta", text: "Hmm. " },
      { type: "thinking_delta", text: "Yes." },
      { type: "text_delta", text: "LAX " },
      { type: "text_delta", text: "too." },
      { type: "done", stopReason: "end_turn" },
    ]);
    const events = await runWith(client);
    expect(events.map((e) => e.type)).toEqual([
      "message_start",
      "thinking_delta",
      "thinking_delta",
      "thinking_end",
      "text_delta",
      "text_delta",
      "message_end",
    ]);
    const messageIds = new Set(events.map((e) => ("messageId" in e ? e.messageId : undefined)));
    expect(messageIds.size).toBe(1);
    expect(events[0]).toMatchObject({ modelId: "claude-headless-model" });
    expect(events.at(-1)).toMatchObject({ stopReason: "end_turn" });

    // The whole history goes to the client, with no system prompt.
    expect(seen[0]!.messages).toHaveLength(3);
    expect(seen[0]!.system).toBeUndefined();
  });

  it("passes max_tokens through and maps other stop reasons to end_turn", async () => {
    const maxed = await runWith(fakeClient([{ type: "text_delta", text: "a" }, { type: "done", stopReason: "max_tokens" }]).client);
    expect(maxed.at(-1)).toMatchObject({ type: "message_end", stopReason: "max_tokens" });
    const other = await runWith(fakeClient([{ type: "text_delta", text: "a" }, { type: "done", stopReason: "stop_sequence" }]).client);
    expect(other.at(-1)).toMatchObject({ type: "message_end", stopReason: "end_turn" });
  });

  it("turns an LlmError before any output into an HttpError (a normal 4xx/5xx)", async () => {
    const err = await runWith(fakeClient([], new LlmError("auth", "Claude is not logged in.")).client).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ code: "model_unavailable", status: 503, message: "Claude is not logged in." });
  });

  it("turns an LlmError after output started into an error event", async () => {
    const events = await runWith(fakeClient([{ type: "text_delta", text: "Half" }], new LlmError("internal", "Claude crashed.")).client);
    expect(events.map((e) => e.type)).toEqual(["message_start", "text_delta", "error"]);
    expect(events.at(-1)).toEqual({ type: "error", error: { code: "internal", message: "Claude crashed." } });
  });

  it.each(["gemini", "claude-headless"] as const)("sends a %s model's turn to that provider's client", async (provider) => {
    const { client, seen } = fakeClient([{ type: "text_delta", text: "Hi" }, { type: "done", stopReason: "end_turn" }]);
    const events = await runWith(client, provider);
    expect(events.map((e) => e.type)).toEqual(["message_start", "text_delta", "message_end"]);
    expect(seen).toHaveLength(1);
  });
});
