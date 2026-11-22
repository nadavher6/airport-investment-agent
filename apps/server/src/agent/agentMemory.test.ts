import { asConversationId, asModelId, type AgentEvent, type ChatTurn, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { LlmClient, LlmRequest } from "../llm/llmClient.ts";
import { fakeScoreAirports } from "../test/fakeScoreAirports.ts";
import { collect } from "../test/helpers.ts";
import { CLASSIFIER_PROMPT } from "./classifier/prompt.ts";
import { LlmPassthroughAgent } from "./llmPassthroughAgent.ts";
import { ConversationMemory } from "./memory/conversationMemory.ts";
import { defineTool, ok } from "./tools/tool.ts";

/**
 * Conversation memory through the whole agent (#50), with a fake LLM and no real API call. The fake model
 * follows the loop prompt: it calls a tool for a code it has no data for, and answers from the "Airport data in
 * focus" block when the data is there.
 */
const model: ModelInfo = {
  id: asModelId("claude-headless-model"),
  label: "Claude",
  provider: "claude-headless",
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
};

const FOCUS = "## Airport data in focus";
const codesIn = (text: string): string[] => [...new Set(text.match(/\b[A-Z]{3}\b/g) ?? [])];
const focusBlock = (system: string | undefined): string => (system?.includes(FOCUS) ? system.slice(system.indexOf(FOCUS)) : "");

/** A fake client; `label` is the classifier's answer. Records every main (tool loop) request. */
function fakeClient(label = "in_scope", delayMs = 0) {
  const seen: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "claude-headless",
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      if (request.system === CLASSIFIER_PROMPT) {
        yield { type: "text_delta", text: JSON.stringify({ label, reason: "x" }) };
        yield { type: "done", stopReason: "end_turn" };
        return;
      }
      seen.push({ ...request, messages: [...request.messages] });
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      const last = request.messages.at(-1)!.content;
      const question = request.messages.filter((m) => !m.content.startsWith("<tool_result")).at(-1)!.content;
      const inFocus = focusBlock(request.system);
      let text: string;
      if (last.startsWith("<tool_result")) text = `Answer from the tool: ${last.slice(0, 200)}`;
      else if (/compare|better|higher/i.test(question) && codesIn(question).length >= 2) {
        text = JSON.stringify({ tool: "score_airports", input: { airport_codes: codesIn(question) } });
      } else if (inFocus !== "") text = `Answer from memory: ${inFocus}`;
      else if (codesIn(question).length > 0) {
        text = JSON.stringify({ tool: "get_enplanements", input: { airport_code: codesIn(question)[0] } });
      } else text = "Which airport do you mean?";
      yield { type: "text_delta", text };
      yield { type: "done", stopReason: "end_turn" };
    },
  };
  return { client, seen };
}

/** A recording fake get_enplanements: 2019 and 2024 numbers made from the code, so chats can be told apart. */
function fakeEnplanements() {
  const calls: string[] = [];
  const tool = defineTool({
    name: "get_enplanements",
    description: "FAKE get_enplanements for tests.",
    inputSchema: z.object({ airport_code: z.string().transform((c) => c.toUpperCase()) }).strict(),
    exampleInput: { airport_code: "LAX" },
    run: (input) => {
      calls.push(input.airport_code);
      return Promise.resolve(ok({ airportCode: input.airport_code, byYear: { 2019: `${input.airport_code}-2019-total`, 2024: `${input.airport_code}-2024-total` } }));
    },
  });
  return { tool, calls };
}

function setup(label = "in_scope", delayMs = 0) {
  const { client, seen } = fakeClient(label, delayMs);
  const score = fakeScoreAirports();
  const enplanements = fakeEnplanements();
  const memory = new ConversationMemory();
  const agent = new LlmPassthroughAgent({ "claude-headless": client, gemini: client }, undefined, {
    scoreAirports: score.tool,
    toolOverrides: [enplanements.tool],
    memory,
  });
  return { agent, seen, score, enplanements, memory };
}

const text = (events: AgentEvent[]): string => events.flatMap((e) => (e.type === "text_delta" ? [e.delta] : [])).join("");
const toolCalls = (events: AgentEvent[]): string[] => events.flatMap((e) => (e.type === "tool_call" ? [e.name] : []));

/** One chat: each `say` sends the whole history plus the new turn, with this chat's id (or none). */
function chat(agent: LlmPassthroughAgent, conversationId?: string) {
  const history: ChatTurn[] = [];
  return async (content: string): Promise<AgentEvent[]> => {
    history.push({ role: "user", content });
    const request = {
      modelId: model.id,
      messages: [...history],
      ...(conversationId !== undefined ? { conversationId: asConversationId(conversationId) } : {}),
    };
    const events = await collect(agent.run({ request, model, signal: new AbortController().signal }));
    history.push({ role: "assistant", content: text(events) });
    return events;
  };
}

describe("agent memory (#50)", () => {
  it('uses memory across two turns of one chat: "LAX passengers?" then "what about its 2019 numbers?"', async () => {
    const { agent, seen, enplanements } = setup();
    const say = chat(agent, "chat-1");

    const first = await say("How many passengers did LAX have in 2024?");
    expect(toolCalls(first)).toEqual(["classify_message", "get_enplanements"]);
    const second = await say("what about its 2019 numbers?");

    expect(toolCalls(second)).toEqual(["classify_message"]); // no tool: answered from memory
    expect(enplanements.calls).toEqual(["LAX"]);
    expect(focusBlock(seen.at(-1)!.system)).toContain("LAX-2019-total");
    expect(text(second)).toContain("Answer from memory");
  });

  it('"compare LAX and SNA" then "why is LAX higher?" reuses the cached scores (no re-fetch)', async () => {
    const { agent, seen, score } = setup();
    const say = chat(agent, "chat-1");

    await say("compare LAX and SNA");
    const second = await say("why is LAX higher than SNA?");

    expect(score.calls).toEqual([["LAX", "SNA"]]); // scored once, in the first turn only
    expect(toolCalls(second)).toEqual(["classify_message", "score_airports"]);
    const result = second.find((e) => e.type === "tool_result");
    expect(result?.type === "tool_result" && result.result.ok).toBe(true);
    // The second turn also starts with both airports' scores in its system prompt.
    const block = focusBlock(seen.find((r) => r.messages.at(-1)!.content === "why is LAX higher than SNA?")!.system);
    expect(block).toContain('"LAX"');
    expect(block).toContain('"SNA"');
  });

  it("brings back both scored airports for a follow-up naming only one, and answers from them", async () => {
    const { agent, seen, score } = setup();
    const say = chat(agent, "chat-1");

    await say("compare LAX and SNA");
    const second = await say("why is LAX the top one?");

    expect(score.calls).toHaveLength(1);
    expect(toolCalls(second)).toEqual(["classify_message"]);
    const block = focusBlock(seen.at(-1)!.system);
    expect(block).toContain('"airportCode":"LAX"');
    expect(block).toContain('"airportCode":"SNA"');
  });

  it("two conversations that start with the same text never share data", async () => {
    const { agent, seen, enplanements, memory } = setup();
    const a = chat(agent, "chat-a");
    const b = chat(agent, "chat-b");

    await a("How many passengers did LAX have in 2024?");
    await b("How many passengers did LAX have in 2024?");
    expect(enplanements.calls).toEqual(["LAX", "LAX"]); // chat b fetched its own data
    expect(seen[2]!.system).not.toContain(FOCUS); // chat b's first call had no memory from chat a

    await a("what about its 2019 numbers?");
    expect(enplanements.calls).toHaveLength(2);
    expect(memory.size).toBe(2);
  });

  it("with no conversationId there is no memory: no reads, no writes, no re-use", async () => {
    const { agent, seen, enplanements, memory } = setup();
    const say = chat(agent);

    await say("How many passengers did LAX have in 2024?");
    await say("What about LAX in 2019?");

    expect(enplanements.calls).toEqual(["LAX", "LAX"]); // fetched again: nothing was cached
    expect(memory.size).toBe(0);
    for (const request of seen) expect(request.system).not.toContain(FOCUS);
  });

  it("also remembers on the grading path", async () => {
    const { agent, seen, enplanements } = setup("grading");
    const say = chat(agent, "chat-1");

    await say("Grade LAX for me");
    await say("and its 2019 numbers?");

    expect(enplanements.calls).toEqual(["LAX"]);
    expect(focusBlock(seen.at(-1)!.system)).toContain("LAX-2019-total");
  });

  it("shares nothing across conversations under concurrency", async () => {
    const { agent, enplanements, memory } = setup("in_scope", 5);
    const codes = ["LAX", "SFO", "DEN", "ORD", "ATL", "JFK", "SEA", "BOS"];
    const chats = codes.map((code, i) => ({ code, say: chat(agent, `chat-${i}`) }));

    await Promise.all(chats.map(({ code, say }) => say(`How many passengers did ${code} have?`)));
    const followUps = await Promise.all(chats.map(({ say }) => say("what about its 2019 numbers?")));

    expect([...enplanements.calls].sort()).toEqual([...codes].sort()); // one fetch per chat, none re-used across
    expect(memory.size).toBe(codes.length);
    followUps.forEach((events, i) => {
      const answer = text(events);
      expect(answer).toContain(`${codes[i]}-2019-total`);
      for (const other of codes.filter((c) => c !== codes[i])) expect(answer).not.toContain(`${other}-2019`);
    });
  });
});
