import { LlmError, type LlmStreamEvent } from "../llmClient.ts";

/**
 * Maps `claude -p --output-format stream-json --verbose --include-partial-messages` lines
 * to LlmStreamEvents. Pure: feed it parsed lines, it returns the events to emit.
 *
 * The lines we use (everything else is ignored):
 *   {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"…"}}}
 *   {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"…"}}}
 *   {"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn"}}}
 *   {"type":"assistant","message":{"content":[{"type":"text","text":"…"}]}}   (whole message, after its deltas)
 *   {"type":"result","subtype":"success","is_error":false,"result":"…"}       (last line)
 */

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export type MapperOutcome =
  | { readonly kind: "running" }
  | { readonly kind: "done" }
  | { readonly kind: "failed"; readonly error: LlmError };

export class StreamJsonMapper {
  private sawText = false;
  private stopReason = "end_turn";
  outcome: MapperOutcome = { kind: "running" };

  map(line: unknown): LlmStreamEvent[] {
    if (!isObject(line) || this.outcome.kind !== "running") return [];
    switch (line.type) {
      case "stream_event":
        return isObject(line.event) ? this.mapStreamEvent(line.event) : [];
      case "assistant":
        return this.mapAssistant(line.message);
      case "result":
        return this.mapResult(line);
      default:
        return [];
    }
  }

  private mapStreamEvent(event: Json): LlmStreamEvent[] {
    if (event.type === "message_delta") {
      const stop = isObject(event.delta) ? str(event.delta.stop_reason) : undefined;
      if (stop) this.stopReason = stop;
      return [];
    }
    if (event.type !== "content_block_delta" || !isObject(event.delta)) return [];
    const { delta } = event;
    if (delta.type === "thinking_delta") {
      const text = str(delta.thinking);
      return text ? [{ type: "thinking_delta", text }] : [];
    }
    if (delta.type === "text_delta") {
      const text = str(delta.text);
      if (!text) return [];
      this.sawText = true;
      return [{ type: "text_delta", text }];
    }
    return [];
  }

  /** Fallback when partial messages were not streamed: emit the whole message's text once. */
  private mapAssistant(message: unknown): LlmStreamEvent[] {
    if (this.sawText || !isObject(message) || !Array.isArray(message.content)) return [];
    const text = message.content
      .filter((block): block is Json => isObject(block) && block.type === "text")
      .map((block) => str(block.text) ?? "")
      .join("");
    if (!text) return [];
    this.sawText = true;
    return [{ type: "text_delta", text }];
  }

  private mapResult(line: Json): LlmStreamEvent[] {
    if (line.is_error === true || (line.subtype !== undefined && line.subtype !== "success")) {
      this.outcome = { kind: "failed", error: claudeFailure(str(line.result) ?? str(line.subtype) ?? "") };
      return [];
    }
    this.outcome = { kind: "done" };
    return [{ type: "done", stopReason: this.stopReason }];
  }
}

/** Turns whatever `claude` printed on failure into an LlmError with one short, plain-English sentence. */
export function claudeFailure(raw: string): LlmError {
  const text = raw.trim();
  if (/not logged in|\/login|log ?in|authenticat|unauthori[sz]ed|invalid api key|\b401\b/i.test(text)) {
    return new LlmError("auth", "Claude is not logged in. Run `claude` in a terminal and log in, then try again.");
  }
  if (/rate.?limit|usage limit|\b429\b|overloaded/i.test(text)) {
    return new LlmError("rate_limit", "Claude is rate limited or overloaded right now. Try again in a little while.");
  }
  if (!text) return new LlmError("internal", "Claude stopped without saying why.");
  const firstLine = text.split("\n").find((l) => l.trim() !== "") ?? text;
  return new LlmError("internal", firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine);
}
