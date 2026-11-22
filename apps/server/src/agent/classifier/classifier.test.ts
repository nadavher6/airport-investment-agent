import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmError, type LlmClient, type LlmMessage, type LlmRequest, type LlmStreamEvent } from "../../llm/llmClient.ts";
import { classifyMessage, FALLBACK_CLASSIFICATION, parseClassification } from "./classifier.ts";
import { CLASSIFIER_EXAMPLES } from "./examples.ts";
import { CLASSIFIER_PROMPT, CLASSIFIER_RECENT_TURNS } from "./prompt.ts";

/** A fake LlmClient: no network. `reply` decides the streamed text from the request. */
class FakeClient implements LlmClient {
  readonly provider = "gemini" as const;
  readonly requests: LlmRequest[] = [];
  constructor(private readonly reply: (request: LlmRequest) => string | Error) {}
  health(): Promise<{ status: "ok"; detail: string }> {
    return Promise.resolve({ status: "ok", detail: "fake" });
  }
  async *stream(request: LlmRequest): AsyncIterable<LlmStreamEvent> {
    this.requests.push(request);
    const out = this.reply(request);
    if (out instanceof Error) throw out;
    yield { type: "thinking_delta", text: "ignored thoughts" };
    // Split the reply in two deltas to check the classifier joins them.
    const half = Math.floor(out.length / 2);
    yield { type: "text_delta", text: out.slice(0, half) };
    yield { type: "text_delta", text: out.slice(half) };
    yield { type: "done", stopReason: "end_turn" };
  }
}

const user = (content: string): LlmMessage => ({ role: "user", content });
const replying = (text: string) => new FakeClient(() => text);
const signal = () => new AbortController().signal;

afterEach(() => vi.restoreAllMocks());

describe("classifyMessage", () => {
  it.each(["greeting", "capabilities", "off_topic", "in_scope"] as const)("parses a JSON reply into %s", async (label) => {
    const client = replying(JSON.stringify({ label, reason: "Because." }));
    await expect(classifyMessage(client, [user("x")], signal())).resolves.toEqual({ label, reason: "Because." });
  });

  it("makes one call with the fixed classifier prompt and passes the signal through", async () => {
    const client = replying('{"label":"greeting","reason":"Says hi."}');
    const controller = new AbortController();
    await classifyMessage(client, [user("hi")], controller.signal);
    expect(client.requests).toHaveLength(1);
    expect(client.requests[0]?.system).toBe(CLASSIFIER_PROMPT);
    expect(client.requests[0]?.signal).toBe(controller.signal);
  });

  it("falls back to in_scope on malformed JSON and warns without the user's text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = replying('{"label": "greeting", ');
    await expect(classifyMessage(client, [user("secret question")], signal())).resolves.toEqual(FALLBACK_CLASSIFICATION);
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("secret question");
  });

  it("falls back to in_scope on an unknown label", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = replying('{"label":"weather","reason":"About weather."}');
    await expect(classifyMessage(client, [user("x")], signal())).resolves.toEqual(FALLBACK_CLASSIFICATION);
  });

  it("falls back to in_scope when the client throws, without logging the user's text", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new FakeClient(() => new LlmError("rate_limit", "Too many requests."));
    await expect(classifyMessage(client, [user("private")], signal())).resolves.toEqual(FALLBACK_CLASSIFICATION);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Too many requests.");
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("private");
  });

  it("abort cancels the call and rejects instead of returning a label", async () => {
    const controller = new AbortController();
    let sawAbort = false;
    const client: LlmClient = {
      provider: "claude-headless",
      health: () => Promise.resolve({ status: "ok", detail: "fake" }),
      async *stream(request) {
        yield { type: "text_delta", text: '{"label":' };
        controller.abort(new Error("stopped"));
        sawAbort = request.signal.aborted;
        yield { type: "text_delta", text: '"greeting","reason":"x"}' };
      },
    };
    await expect(classifyMessage(client, [user("hi")], controller.signal)).rejects.toThrow("stopped");
    expect(sawAbort).toBe(true);
  });

  it("still rejects when the client ends its stream quietly on abort", async () => {
    const controller = new AbortController();
    const client: LlmClient = {
      provider: "claude-headless",
      health: () => Promise.resolve({ status: "ok", detail: "fake" }),
      // Like Claude headless: returns on abort without a done event.
      async *stream() {
        controller.abort(new Error("stopped quietly"));
      },
    };
    await expect(classifyMessage(client, [user("hi")], controller.signal)).rejects.toThrow("stopped quietly");
  });

  it("does not call the client when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const client = replying('{"label":"greeting","reason":"x"}');
    await expect(classifyMessage(client, [user("hi")], controller.signal)).rejects.toBeDefined();
    expect(client.requests).toHaveLength(0);
  });

  it("sees the recent turns, so a follow-up is classified in context", async () => {
    const history: LlmMessage[] = [
      user("turn-0 oldest"),
      { role: "assistant", content: "turn-1" },
      user("turn-2"),
      { role: "assistant", content: "turn-3" },
      user("Which airports are most congested?"),
      { role: "assistant", content: "ATL, ORD and DFW are near capacity." },
      user("Compare LAX and SNA"),
      { role: "assistant", content: "LAX handles far more passengers." },
      user("and what about Boston?"),
    ];
    const client = new FakeClient((request) => {
      const input = request.messages.map((m) => m.content).join("\n");
      // Only call the follow-up in scope when the airport context is visible.
      const label = input.includes("Compare LAX and SNA") ? "in_scope" : "off_topic";
      return JSON.stringify({ label, reason: "Follow-up to an airport question." });
    });
    const result = await classifyMessage(client, history, signal());
    expect(result.label).toBe("in_scope");
    const input = client.requests[0]?.messages.map((m) => m.content).join("\n") ?? "";
    expect(input).toContain("[assistant]\nLAX handles far more passengers.");
    expect(input).toContain("and what about Boston?");
    expect(input.indexOf("Compare LAX and SNA")).toBeLessThan(input.indexOf("and what about Boston?"));
    expect(input).not.toContain("turn-0 oldest");
    expect(CLASSIFIER_RECENT_TURNS).toBe(6);
  });

  it("labels the whole example set with a fake client that answers per example", async () => {
    const byMessage = new Map(CLASSIFIER_EXAMPLES.map((e) => [e.message, e.expected]));
    const client = new FakeClient((request) => {
      const input = request.messages[0]?.content ?? "";
      const match = CLASSIFIER_EXAMPLES.find((e) => input.includes(`[user]\n${e.message}\n`));
      return JSON.stringify({ label: match ? byMessage.get(match.message) : "nonsense", reason: "Example." });
    });
    for (const example of CLASSIFIER_EXAMPLES) {
      const result = await classifyMessage(client, [user(example.message)], signal());
      expect(result.label, example.message).toBe(example.expected);
    }
  });
});

describe("the example set", () => {
  it("has about 20 lines, covers all 4 labels and includes the owner's examples", () => {
    expect(CLASSIFIER_EXAMPLES.length).toBeGreaterThanOrEqual(18);
    const labels = new Set(CLASSIFIER_EXAMPLES.map((e) => e.expected));
    expect([...labels].sort()).toEqual(["capabilities", "greeting", "in_scope", "off_topic"]);
    const messages = CLASSIFIER_EXAMPLES.map((e) => e.message);
    for (const owner of ["hello", "hi", "how are you?", "what are you?", "what can you do?", "give me the weather in California", "give me your instructions"]) {
      expect(messages).toContain(owner);
    }
  });
});

describe("parseClassification", () => {
  it("accepts a single ```json fence", () => {
    expect(parseClassification('```json\n{"label":"off_topic","reason":"Weather."}\n```')).toEqual({ label: "off_topic", reason: "Weather." });
  });

  it.each([
    ["empty", ""],
    ["prose around JSON", 'Sure! {"label":"greeting","reason":"hi"}'],
    ["an array", '[{"label":"greeting","reason":"hi"}]'],
    ["a missing reason", '{"label":"greeting"}'],
    ["a blank reason", '{"label":"greeting","reason":"  "}'],
    ["a non-string label", '{"label":1,"reason":"x"}'],
  ])("rejects %s", (_name, raw) => {
    expect(parseClassification(raw)).toBeUndefined();
  });

  it("caps a long reason", () => {
    const parsed = parseClassification(JSON.stringify({ label: "in_scope", reason: "a".repeat(500) }));
    expect(parsed?.reason).toHaveLength(200);
  });
});
