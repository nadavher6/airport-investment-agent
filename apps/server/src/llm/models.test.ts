import { asModelId, type ModelInfo, type ModelProvider } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { LlmPassthroughAgent } from "../agent/llmPassthroughAgent.ts";
import { classifyMessage } from "../agent/classifier/classifier.ts";
import { CANDIDATE_PROMPT } from "../agent/prompts/candidates.ts";
import { collect } from "../test/helpers.ts";
import type { LlmClient, LlmRequest } from "./llmClient.ts";
import { MODELS, mainModel } from "./models.ts";

const info = (provider: ModelProvider): ModelInfo => ({
  id: asModelId(`${provider}-model`),
  label: provider,
  provider,
  description: "",
  capabilities: { thinking: true, toolUse: false },
  available: true,
});

/**
 * A fake client that records every request; it answers the candidate step (#42) with no airports and every
 * other call with the classifier's JSON.
 */
function recorder(provider: ModelProvider): { client: LlmClient; requests: LlmRequest[] } {
  const requests: LlmRequest[] = [];
  const client: LlmClient = {
    provider,
    health: async () => ({ status: "ok", detail: "fake" }),
    async *stream(request) {
      requests.push(request);
      const text = request.system === CANDIDATE_PROMPT ? '{"codes":[],"cities":[],"region":null}' : '{"label":"in_scope","reason":"Airports."}';
      yield { type: "text_delta", text };
      yield { type: "done", stopReason: "end_turn" };
    },
  };
  return { client, requests };
}

const other = (provider: ModelProvider): ModelProvider => (provider === "gemini" ? "claude-headless" : "gemini");

/** Runs one in_scope turn; returns the models of the classifier call, the candidate call (#42) and the main call. */
async function runTurn(provider: ModelProvider, claudeMainModel?: string): Promise<(string | undefined)[]> {
  const { client, requests } = recorder(provider);
  const unused = recorder(other(provider)).client;
  const clients = { [provider]: client, [other(provider)]: unused } as Record<ModelProvider, LlmClient>;
  const agent = new LlmPassthroughAgent(clients, claudeMainModel);
  await collect(
    agent.run({
      request: { modelId: info(provider).id, messages: [{ role: "user", content: "Rank SFO" }] },
      model: info(provider),
      signal: new AbortController().signal,
    }),
  );
  return requests.map((r) => r.model);
}

describe("model picks (#17)", () => {
  it("has the owner's picks", () => {
    expect(MODELS).toEqual({
      "claude-headless": { classifier: "haiku", main: "opus" },
      gemini: { classifier: "gemini-flash-lite-latest", main: "gemini-3.5-flash" },
    });
  });

  it.each(["claude-headless", "gemini"] as const)("classifier gets the fast model and the main call the good one (%s)", async (provider) => {
    expect(await runTurn(provider)).toEqual([MODELS[provider].classifier, MODELS[provider].classifier, MODELS[provider].main]);
  });

  it("CLAUDE_MODEL overrides only the Claude main model", async () => {
    expect(await runTurn("claude-headless", "sonnet")).toEqual(["haiku", "haiku", "sonnet"]);
    expect(await runTurn("gemini", "sonnet")).toEqual(["gemini-flash-lite-latest", "gemini-flash-lite-latest", "gemini-3.5-flash"]);
    expect(mainModel("claude-headless")).toBe("opus");
    expect(mainModel("claude-headless", "sonnet")).toBe("sonnet");
    expect(mainModel("gemini", "sonnet")).toBe("gemini-3.5-flash");
  });

  it("classifyMessage ignores any override: it always uses the classifier model", async () => {
    const { client, requests } = recorder("claude-headless");
    await classifyMessage(client, [{ role: "user", content: "hi" }], new AbortController().signal);
    expect(requests[0]?.model).toBe("haiku");
  });
});
