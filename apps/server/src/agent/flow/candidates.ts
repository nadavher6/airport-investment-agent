import { randomUUID } from "node:crypto";
import { asToolCallId, type MessageId, type ToolCallEvent, type ToolResultEvent } from "@airport/shared";
import { z } from "zod";
import type { LlmClient, LlmMessage } from "../../llm/llmClient.ts";
import { MODELS } from "../../llm/models.ts";
import { CANDIDATE_PROMPT, CANDIDATE_RECENT_TURNS, CANDIDATE_TURN_CHARS } from "../prompts/candidates.ts";

/** The candidate step's strict JSON reply (#42). Bounded so a runaway reply is rejected, not used. */
const candidatesSchema = z
  .object({
    codes: z.array(z.string().trim().min(1).max(10)).max(25),
    cities: z.array(z.string().trim().min(1).max(80)).max(20),
    region: z.string().trim().min(1).max(80).nullable(),
  })
  .strict();

export type Candidates = z.infer<typeof candidatesSchema>;

export interface CandidateResult {
  readonly candidates: Candidates;
  /** 2 when the first reply was invalid and the model was asked once more (the #19 pattern). */
  readonly attempts: 1 | 2;
  /** True when no valid reply came back (or the call failed): the no-candidates path. */
  readonly fallback: boolean;
}

/** The no-candidates fallback: nothing to score. */
export const NO_CANDIDATES: Candidates = { codes: [], cities: [], region: null };

/** Strict parse: one JSON object in the schema, optionally in one ```json fence. Undefined otherwise. */
export function parseCandidates(raw: string): Candidates | undefined {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(raw.trim());
  let value: unknown;
  try {
    value = JSON.parse((fenced?.[1] ?? raw).trim());
  } catch {
    return undefined;
  }
  const parsed = candidatesSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

const truncate = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max)}...` : text);

/** The last few turns as one transcript, so the model extracts rather than answers. */
export function buildCandidateInput(messages: readonly LlmMessage[]): string {
  const transcript = messages
    .slice(-CANDIDATE_RECENT_TURNS)
    .map((m) => `[${m.role}]\n${truncate(m.content, CANDIDATE_TURN_CHARS)}`)
    .join("\n\n");
  return `Transcript (oldest first):\n\n${transcript}\n\nPick the airports the last user message is about. Reply with JSON only.`;
}

/** The retry input: the same input, the previous raw answer, and the required shape. */
export function buildCandidateRetryInput(input: string, previousAnswer: string): string {
  return (
    `${input}\n\nYour previous answer was:\n"""\n${truncate(previousAnswer, 500)}\n"""\n\n` +
    'Your previous answer was not valid. Reply with JSON only, exactly {"codes": string[], "cities": string[], "region": string | null}.'
  );
}

async function callOnce(client: LlmClient, content: string, signal: AbortSignal): Promise<string> {
  let text = "";
  const request = {
    system: CANDIDATE_PROMPT,
    model: MODELS[client.provider].classifier,
    messages: [{ role: "user", content }] as const,
    signal,
  };
  for await (const event of client.stream(request)) {
    signal.throwIfAborted();
    if (event.type === "text_delta") text += event.text;
  }
  signal.throwIfAborted();
  return text;
}

/**
 * The candidate step (#42): one call with the fast (classifier) model returning strict JSON. An invalid reply
 * gets ONE retry showing the previous answer; still invalid, or a failed call, falls back to no candidates
 * (the turn is still answered, without scores). An abort rethrows.
 */
export async function pickCandidates(client: LlmClient, messages: readonly LlmMessage[], signal: AbortSignal): Promise<CandidateResult> {
  signal.throwIfAborted();
  const input = buildCandidateInput(messages);
  let previousAnswer: string | undefined;
  for (const attempts of [1, 2] as const) {
    let text: string;
    try {
      text = await callOnce(client, previousAnswer === undefined ? input : buildCandidateRetryInput(input, previousAnswer), signal);
    } catch (err) {
      if (signal.aborted) throw signal.reason;
      // Never log the user's text: only the provider and the error's own message.
      console.warn(`pick_candidates: ${client.provider} call failed (${err instanceof Error ? err.message : "unknown error"}); no candidates`);
      return { candidates: NO_CANDIDATES, attempts, fallback: true };
    }
    const parsed = parseCandidates(text);
    if (parsed !== undefined) return { candidates: parsed, attempts, fallback: false };
    previousAnswer = text;
  }
  console.warn(`pick_candidates: ${client.provider} reply was not valid after a retry; no candidates`);
  return { candidates: NO_CANDIDATES, attempts: 2, fallback: true };
}

/** The tool name the candidate step is shown under in the chat. */
export const PICK_CANDIDATES_TOOL = "pick_candidates";

/** Shows the candidate step in the chat as a tool_call/tool_result pair (like classify_message). */
export function candidateToolEvents(messageId: MessageId, message: string, picked: CandidateResult): readonly [ToolCallEvent, ToolResultEvent] {
  const toolCallId = asToolCallId(randomUUID());
  const { codes, cities, region } = picked.candidates;
  return [
    { type: "tool_call", messageId, toolCallId, name: PICK_CANDIDATES_TOOL, input: { message } },
    {
      type: "tool_result",
      messageId,
      toolCallId,
      result: { ok: true, output: { codes: [...codes], cities: [...cities], region, attempts: picked.attempts, fallback: picked.fallback } },
    },
  ];
}
