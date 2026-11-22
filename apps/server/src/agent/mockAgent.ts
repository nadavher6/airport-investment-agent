import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { asMessageId, asToolCallId, type AgentEvent } from "@airport/shared";
import type { Agent, AgentRunInput } from "./agent.ts";

/** Split text into word-sized chunks so the UI sees a realistic token stream. */
function* chunks(text: string): Generator<string> {
  for (const match of text.matchAll(/\S+\s*/g)) yield match[0];
}

/**
 * Placeholder agent. It doesn't call a model. It emits every event type once,
 * so the frontend's thinking, tool-use and text rendering can be built against it.
 */
export class MockAgent implements Agent {
  constructor(private readonly delayMs = 35) {}

  async *run({ request, model, signal }: AgentRunInput): AsyncGenerator<AgentEvent> {
    const messageId = asMessageId(randomUUID());
    const question = request.messages.at(-1)?.content ?? "";
    const tick = () => sleep(this.delayMs, undefined, { signal });

    yield { type: "message_start", messageId, modelId: model.id };

    if (model.capabilities.thinking) {
      const startedAt = Date.now();
      const thought =
        `The user asked: "${question}". I should identify the airports involved, ` +
        `pull capacity and traffic data, then score them deterministically before explaining.`;
      for (const delta of chunks(thought)) {
        await tick();
        yield { type: "thinking_delta", messageId, delta };
      }
      yield { type: "thinking_end", messageId, durationMs: Date.now() - startedAt };
    }

    if (model.capabilities.toolUse) {
      const toolCallId = asToolCallId(randomUUID());
      yield {
        type: "tool_call",
        messageId,
        toolCallId,
        name: "search_airports",
        input: { query: question, limit: 5 },
      };
      await sleep(this.delayMs * 20, undefined, { signal });
      yield {
        type: "tool_result",
        messageId,
        toolCallId,
        result: { ok: true, output: { note: "mock result: data layer not implemented yet", airports: [] } },
      };
    }

    const answer =
      `This is a **mock response** from \`${model.label}\`. The agent backend is not implemented yet, ` +
      `so nothing was actually analyzed.\n\nOnce the data and scoring layers land, this answer will ` +
      `rank airports with a deterministic score and explain the reasoning.`;
    for (const delta of chunks(answer)) {
      await tick();
      yield { type: "text_delta", messageId, delta };
    }

    yield { type: "message_end", messageId, stopReason: "end_turn" };
  }
}
