import { describe, expect, it } from "vitest";
import { fixtureLines } from "../../test/fakeClaude.ts";
import { LlmError } from "../llmClient.ts";
import { claudeFailure, parseStreamLine, StreamJsonMapper } from "./streamJson.ts";

function mapAll(lines: unknown[]) {
  const mapper = new StreamJsonMapper();
  return { events: lines.flatMap((line) => mapper.map(line)), mapper };
}

describe("StreamJsonMapper", () => {
  it("turns the recorded stream-json fixture into thinking deltas, text deltas and done, in order", () => {
    const { events, mapper } = mapAll(fixtureLines("stream-thinking-text.jsonl").map((l) => JSON.parse(l)));
    expect(events).toEqual([
      { type: "thinking_delta", text: "Weigh congestion " },
      { type: "thinking_delta", text: "and demand." },
      { type: "text_delta", text: "High congestion " },
      { type: "text_delta", text: "and growth." },
      { type: "done", stopReason: "end_turn" },
    ]);
    expect(mapper.outcome).toEqual({ kind: "done" });
  });

  it("reports the stop reason from message_delta", () => {
    const { events } = mapAll([
      { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } } },
      { type: "stream_event", event: { type: "message_delta", delta: { stop_reason: "max_tokens" } } },
      { type: "result", subtype: "success", is_error: false },
    ]);
    expect(events.at(-1)).toEqual({ type: "done", stopReason: "max_tokens" });
  });

  it("falls back to the whole assistant message when no partial deltas came, without repeating", () => {
    expect(mapAll([{ type: "assistant", message: { content: [{ type: "text", text: "Whole." }] } }]).events).toEqual([
      { type: "text_delta", text: "Whole." },
    ]);
    const { events } = mapAll([
      { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "A" } } },
      { type: "assistant", message: { content: [{ type: "text", text: "A" }] } },
    ]);
    expect(events).toEqual([{ type: "text_delta", text: "A" }]);
  });

  it("marks an error result as failed with an auth LlmError", () => {
    const { events, mapper } = mapAll([{ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }]);
    expect(events).toEqual([]);
    expect(mapper.outcome.kind).toBe("failed");
    const error = mapper.outcome.kind === "failed" ? mapper.outcome.error : undefined;
    expect(error).toBeInstanceOf(LlmError);
    expect(error).toMatchObject({ code: "auth", message: expect.stringMatching(/not logged in/i) });
  });

  it("ignores lines it does not know", () => {
    expect(mapAll([null, 3, { type: "system", subtype: "init" }, { type: "stream_event", event: { type: "ping" } }]).events).toEqual([]);
  });
});

describe("parseStreamLine", () => {
  it("accepts the documented shapes and rejects wrong types", () => {
    expect(parseStreamLine({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "A" } } })).toEqual({ kind: "text_delta", text: "A" });
    expect(parseStreamLine({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: 5 } } })).toBeUndefined();
    expect(parseStreamLine({ type: "stream_event", event: { type: "message_delta", delta: { stop_reason: "end_turn" } } })).toEqual({ kind: "stop_reason", stopReason: "end_turn" });
    expect(parseStreamLine({ type: "result", subtype: "success", is_error: false, result: "ok" })).toEqual({ kind: "result", isError: false, subtype: "success", result: "ok" });
    expect(parseStreamLine({ type: "assistant", message: { content: "not an array" } })).toBeUndefined();
  });
});

describe("claudeFailure", () => {
  it("classifies auth and rate limit failures", () => {
    expect(claudeFailure("Invalid API key · Please run /login").code).toBe("auth");
    expect(claudeFailure("API Error: 429 rate_limit_error").code).toBe("rate_limit");
  });
  it("keeps the first line of anything else, shortened", () => {
    expect(claudeFailure("\nboom\nstack")).toMatchObject({ code: "internal", message: "boom" });
    expect(claudeFailure("x".repeat(300)).message).toHaveLength(201);
    expect(claudeFailure("").message).toMatch(/without saying why/);
  });
});
