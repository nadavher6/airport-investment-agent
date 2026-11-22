import type { AgentEvent, MessageId, StopReason } from "@airport/shared";

/**
 * Maps `claude -p --output-format stream-json --verbose --include-partial-messages` lines
 * to our AgentEvents. Pure: feed it parsed lines, it returns the events to emit.
 *
 * The lines we use (everything else is ignored):
 *   {"type":"stream_event","event":{"type":"content_block_start","index":0,"content_block":{"type":"thinking"}}}
 *   {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"…"}}}
 *   {"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"…"}}}
 *   {"type":"stream_event","event":{"type":"content_block_stop","index":0}}
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
  | { readonly kind: "failed"; readonly detail: string };

export class StreamJsonMapper {
  private thinkingStartedAt: number | undefined;
  /** Only close thinking we actually showed: a thinking block with no text emits nothing. */
  private thinkingEmitted = false;
  private sawText = false;
  private stopReason: StopReason = "end_turn";
  /** True once a line carrying model output (not just session setup) has arrived. */
  sawContent = false;
  outcome: MapperOutcome = { kind: "running" };

  constructor(
    private readonly messageId: MessageId,
    private readonly now: () => number = Date.now,
  ) {}

  map(line: unknown): AgentEvent[] {
    if (!isObject(line) || this.outcome.kind !== "running") return [];
    switch (line.type) {
      case "stream_event":
        this.sawContent = true;
        return isObject(line.event) ? this.mapStreamEvent(line.event) : [];
      case "assistant":
        this.sawContent = true;
        return this.mapAssistant(line.message);
      case "result":
        return this.mapResult(line);
      default:
        return [];
    }
  }

  private mapStreamEvent(event: Json): AgentEvent[] {
    const { messageId } = this;
    switch (event.type) {
      case "content_block_start": {
        const block = isObject(event.content_block) ? event.content_block : {};
        if (block.type === "thinking" && this.thinkingStartedAt === undefined) this.thinkingStartedAt = this.now();
        return [];
      }
      case "content_block_delta": {
        const delta = isObject(event.delta) ? event.delta : {};
        if (delta.type === "thinking_delta") {
          const text = str(delta.thinking);
          if (!text) return [];
          this.thinkingStartedAt ??= this.now();
          this.thinkingEmitted = true;
          return [{ type: "thinking_delta", messageId, delta: text }];
        }
        if (delta.type === "text_delta") {
          const text = str(delta.text);
          if (!text) return [];
          this.sawText = true;
          return [...this.endThinking(), { type: "text_delta", messageId, delta: text }];
        }
        return [];
      }
      case "content_block_stop":
        return this.endThinking();
      case "message_delta": {
        const delta = isObject(event.delta) ? event.delta : {};
        if (delta.stop_reason === "max_tokens") this.stopReason = "max_tokens";
        return [];
      }
      default:
        return [];
    }
  }

  /** Fallback when partial messages were not streamed: emit the whole message's text once. */
  private mapAssistant(message: unknown): AgentEvent[] {
    if (this.sawText || !isObject(message) || !Array.isArray(message.content)) return [];
    const text = message.content
      .filter((block): block is Json => isObject(block) && block.type === "text")
      .map((block) => str(block.text) ?? "")
      .join("");
    if (!text) return [];
    this.sawText = true;
    return [...this.endThinking(), { type: "text_delta", messageId: this.messageId, delta: text }];
  }

  private mapResult(line: Json): AgentEvent[] {
    if (line.is_error === true || (line.subtype !== undefined && line.subtype !== "success")) {
      this.outcome = { kind: "failed", detail: describeClaudeFailure(str(line.result) ?? str(line.subtype) ?? "") };
      return [];
    }
    this.outcome = { kind: "done" };
    return [...this.endThinking(), { type: "message_end", messageId: this.messageId, stopReason: this.stopReason }];
  }

  private endThinking(): AgentEvent[] {
    const startedAt = this.thinkingStartedAt;
    const emitted = this.thinkingEmitted;
    this.thinkingStartedAt = undefined;
    this.thinkingEmitted = false;
    if (startedAt === undefined || !emitted) return [];
    const durationMs = Math.max(0, this.now() - startedAt);
    return [{ type: "thinking_end", messageId: this.messageId, durationMs }];
  }
}

/** Turns whatever `claude` printed on failure into one short, plain-English sentence. */
export function describeClaudeFailure(raw: string): string {
  const text = raw.trim();
  if (/not logged in|\/login|log ?in|authenticat|unauthori[sz]ed|invalid api key|\b401\b/i.test(text)) {
    return "Claude is not logged in. Run `claude` in a terminal and log in, then try again.";
  }
  if (!text) return "Claude stopped without saying why.";
  const firstLine = text.split("\n").find((l) => l.trim() !== "") ?? text;
  return firstLine.length > 200 ? `${firstLine.slice(0, 200)}…` : firstLine;
}
