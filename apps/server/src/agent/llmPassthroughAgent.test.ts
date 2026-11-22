import { asModelId, type ModelInfo, type ModelProvider } from "@airport/shared";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../http/errors.ts";
import { LlmError, type LlmClient, type LlmRequest, type LlmStreamEvent } from "../llm/llmClient.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";

const modelOf = (provider: ModelProvider): ModelInfo => ({
  id: asModelId(`${provider}-model`),
  label: provider,
  provider,
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
});

const CLASSIFIED = '{"label":"in_scope","reason":"Asks about airports."}';

/**
 * A fake LlmClient. The classifier's call (system = CLASSIFIER_PROMPT) gets `classifierReply`; every other
 * call replays `events`, then optionally throws. Records the main calls in `seen`, classifier calls in `classified`.
 */
function fakeClient(events: LlmStreamEvent[], failWith?: LlmError, classifierReply = CLASSIFIED) {
  const seen: LlmRequest[] = [];
  const classified: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) {
        classified.push(request);
        yield { type: "text_delta", text: classifierReply };
        yield { type: "done", stopReason: "end_turn" };
        return;
      }
      seen.push(request);
      yield* events;
      if (failWith) throw failWith;
    },
  };
  return { client, seen, classified };
}

/** A client that must not be called: the passthrough should pick the other provider's client. */
const unused: LlmClient = {
  provider: "gemini",
  health: async () => ({ status: "ok", detail: "unused" }),
  stream: () => {
    throw new Error("the wrong provider's client was called");
  },
};

const runWith = (client: LlmClient, provider: ModelProvider = "claude-headless", signal = new AbortController().signal) => {
  const clients: Record<ModelProvider, LlmClient> = { "claude-headless": unused, gemini: unused };
  clients[provider] = client;
  const agent = new LlmPassthroughAgent(clients);
  const history = [
    { role: "user" as const, content: "Rank SFO" },
    { role: "assistant" as const, content: "It is busy." },
    { role: "user" as const, content: "And LAX?" },
  ];
  return collect(agent.run({ request: { modelId: modelOf(provider).id, messages: history }, model: modelOf(provider), signal }));
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
      "tool_call",
      "tool_result",
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
    expect(events.map((e) => e.type)).toEqual(["message_start", "tool_call", "tool_result", "text_delta", "error"]);
    expect(events.at(-1)).toEqual({ type: "error", error: { code: "internal", message: "Claude crashed." } });
  });


  it("runs the classifier first and shows it as classify_message, then streams the answer as before (#13)", async () => {
    const { client, seen, classified } = fakeClient(
      [{ type: "text_delta", text: "LAX is busy." }, { type: "done", stopReason: "end_turn" }],
      undefined,
      '{"label":"greeting","reason":"Says hello."}',
    );
    const events = await runWith(client);
    expect(events.map((e) => e.type)).toEqual(["message_start", "tool_call", "tool_result", "text_delta", "message_end"]);
    const [, call, result] = events;
    expect(call).toMatchObject({ type: "tool_call", name: "classify_message", input: { message: "And LAX?" } });
    expect(result).toMatchObject({ type: "tool_result", result: { ok: true, output: { label: "greeting", reason: "Says hello." } } });
    expect(call && "toolCallId" in call && result && "toolCallId" in result && call.toolCallId === result.toolCallId).toBe(true);

    // One classifier call that sees the recent turns; the label changes nothing about the main call.
    expect(classified).toHaveLength(1);
    expect(classified[0]!.messages[0]!.content).toContain("Rank SFO");
    expect(classified[0]!.messages[0]!.content).toContain("And LAX?");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.messages).toHaveLength(3);
  });

  it("shows in_scope and still answers when the classifier reply is unclear", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, seen } = fakeClient([{ type: "text_delta", text: "a" }, { type: "done", stopReason: "end_turn" }], undefined, "not json");
    const events = await runWith(client);
    expect(events[2]).toMatchObject({ type: "tool_result", result: { ok: true, output: { label: "in_scope" } } });
    expect(seen).toHaveLength(1);
    vi.restoreAllMocks();
  });

  it("an abort during classification stops the run before the main LLM call", async () => {
    const controller = new AbortController();
    const seen: LlmRequest[] = [];
    const client: LlmClient = {
      provider: "claude-headless",
      health: async () => ({ status: "ok", detail: "fake" }),
      async *stream(request) {
        seen.push(request);
        controller.abort(new Error("Stop pressed"));
      },
    };
    await expect(runWith(client, "claude-headless", controller.signal)).rejects.toThrow("Stop pressed");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.system).toBe(CLASSIFIER_PROMPT);
  });

  it.each(["gemini", "claude-headless"] as const)("sends a %s model's turn to that provider's client", async (provider) => {
    const { client, seen } = fakeClient([{ type: "text_delta", text: "Hi" }, { type: "done", stopReason: "end_turn" }]);
    const events = await runWith(client, provider);
    expect(events.map((e) => e.type)).toEqual(["message_start", "tool_call", "tool_result", "text_delta", "message_end"]);
    expect(seen).toHaveLength(1);
  });
});
