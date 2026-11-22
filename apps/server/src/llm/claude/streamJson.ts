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

/** The stream-json lines we act on, checked at the boundary. Every other line parses to undefined. */
export type StreamLine =
  | { readonly kind: "thinking_delta"; readonly text: string }
  | { readonly kind: "text_delta"; readonly text: string }
  | { readonly kind: "stop_reason"; readonly stopReason: string }
  | { readonly kind: "assistant"; readonly text: string }
  | { readonly kind: "result"; readonly isError: boolean; readonly subtype?: string; readonly result?: string };

function parseStreamEvent(event: Json): StreamLine | undefined {
  const delta = isObject(event.delta) ? event.delta : undefined;
  if (!delta) return undefined;
  if (event.type === "message_delta") {
    const stopReason = str(delta.stop_reason);
    return stopReason ? { kind: "stop_reason", stopReason } : undefined;
  }
  if (event.type !== "content_block_delta") return undefined;
  if (delta.type === "thinking_delta") {
    const text = str(delta.thinking);
    return text ? { kind: "thinking_delta", text } : undefined;
  }
  if (delta.type === "text_delta") {
    const text = str(delta.text);
    return text ? { kind: "text_delta", text } : undefined;
  }
  return undefined;
}

/** Validates one parsed JSON line against the shapes above. */
export function parseStreamLine(line: unknown): StreamLine | undefined {
  if (!isObject(line)) return undefined;
  switch (line.type) {
    case "stream_event":
      return isObject(line.event) ? parseStreamEvent(line.event) : undefined;
    case "assistant": {
      const { message } = line;
      if (!isObject(message) || !Array.isArray(message.content)) return undefined;
      const text = message.content
        .filter((block): block is Json => isObject(block) && block.type === "text")
        .map((block) => str(block.text) ?? "")
        .join("");
      return text ? { kind: "assistant", text } : undefined;
    }
    case "result": {
      const subtype = str(line.subtype);
      const result = str(line.result);
      return { kind: "result", isError: line.is_error === true, ...(subtype !== undefined ? { subtype } : {}), ...(result !== undefined ? { result } : {}) };
    }
    default:
      return undefined;
  }
}

export type MapperOutcome =
  | { readonly kind: "running" }
  | { readonly kind: "done" }
  | { readonly kind: "failed"; readonly error: LlmError };

export class StreamJsonMapper {
  private sawText = false;
  private stopReason = "end_turn";
  outcome: MapperOutcome = { kind: "running" };

  /** Takes one parsed JSON line (anything), returns the events to emit. */
  map(raw: unknown): LlmStreamEvent[] {
    if (this.outcome.kind !== "running") return [];
    const line = parseStreamLine(raw);
    if (!line) return [];
    switch (line.kind) {
      case "thinking_delta":
        return [{ type: "thinking_delta", text: line.text }];
      case "text_delta":
        this.sawText = true;
        return [{ type: "text_delta", text: line.text }];
      case "stop_reason":
        this.stopReason = line.stopReason;
        return [];
      case "assistant":
        // Fallback when partial messages were not streamed: emit the whole message's text once.
        if (this.sawText) return [];
        this.sawText = true;
        return [{ type: "text_delta", text: line.text }];
      case "result":
        if (line.isError || (line.subtype !== undefined && line.subtype !== "success")) {
          this.outcome = { kind: "failed", error: claudeFailure(line.result ?? line.subtype ?? "") };
          return [];
        }
        this.outcome = { kind: "done" };
        return [{ type: "done", stopReason: this.stopReason }];
    }
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
