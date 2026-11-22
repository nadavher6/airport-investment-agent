import { asMessageId } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { fixtureLines } from "../../test/fakeClaude.ts";
import { describeClaudeFailure, StreamJsonMapper } from "./streamJson.ts";

const messageId = asMessageId("m-1");

function mapAll(lines: unknown[], clock = () => 0) {
  const mapper = new StreamJsonMapper(messageId, clock);
  return { events: lines.flatMap((line) => mapper.map(line)), mapper };
}

describe("StreamJsonMapper", () => {
  it("turns the recorded stream-json fixture into thinking, text deltas and end, in order", () => {
    let t = 0;
    const { events, mapper } = mapAll(
      fixtureLines("stream-thinking-text.jsonl").map((l) => JSON.parse(l)),
      () => (t += 100),
    );
    expect(events).toEqual([
      { type: "thinking_delta", messageId, delta: "Weigh congestion " },
      { type: "thinking_delta", messageId, delta: "and demand." },
      { type: "thinking_end", messageId, durationMs: 100 },
      { type: "text_delta", messageId, delta: "High congestion " },
      { type: "text_delta", messageId, delta: "and growth." },
      { type: "message_end", messageId, stopReason: "end_turn" },
    ]);
    expect(mapper.outcome).toEqual({ kind: "done" });
    expect(mapper.sawContent).toBe(true);
  });

  it("does not count the init line as model output", () => {
    const { mapper } = mapAll([{ type: "system", subtype: "init" }]);
    expect(mapper.sawContent).toBe(false);
  });

  it("reports max_tokens as the stop reason", () => {
    const { events } = mapAll([
      { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Hi" } } },
      { type: "stream_event", event: { type: "message_delta", delta: { stop_reason: "max_tokens" } } },
      { type: "result", subtype: "success", is_error: false },
    ]);
    expect(events.at(-1)).toEqual({ type: "message_end", messageId, stopReason: "max_tokens" });
  });

  it("falls back to the whole assistant message when no partial deltas came", () => {
    const { events } = mapAll([
      { type: "assistant", message: { content: [{ type: "text", text: "Whole answer." }] } },
      { type: "result", subtype: "success", is_error: false },
    ]);
    expect(events).toEqual([
      { type: "text_delta", messageId, delta: "Whole answer." },
      { type: "message_end", messageId, stopReason: "end_turn" },
    ]);
  });

  it("does not repeat the text from the assistant message after deltas", () => {
    const { events } = mapAll([
      { type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "A" } } },
      { type: "assistant", message: { content: [{ type: "text", text: "A" }] } },
    ]);
    expect(events).toEqual([{ type: "text_delta", messageId, delta: "A" }]);
  });

  it("marks an error result as failed with a plain-English detail", () => {
    const { events, mapper } = mapAll([{ type: "result", subtype: "success", is_error: true, result: "Not logged in · Please run /login" }]);
    expect(events).toEqual([]);
    expect(mapper.outcome).toEqual({ kind: "failed", detail: expect.stringMatching(/not logged in/i) });
  });

  it("ignores lines it does not know", () => {
    expect(mapAll([null, 3, { type: "user" }, { type: "stream_event", event: { type: "ping" } }]).events).toEqual([]);
  });
});

describe("describeClaudeFailure", () => {
  it("explains auth failures", () => {
    expect(describeClaudeFailure("Invalid API key · Please run /login")).toMatch(/not logged in/);
  });
  it("keeps the first line of anything else, shortened", () => {
    expect(describeClaudeFailure("\nboom\nstack")).toBe("boom");
    expect(describeClaudeFailure("x".repeat(300))).toHaveLength(201);
    expect(describeClaudeFailure("")).toMatch(/without saying why/);
  });
});
