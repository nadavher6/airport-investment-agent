import { asMessageId, asModelId, type ModelInfo } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { collect, scriptedAgent } from "../test/helpers.ts";
import { AgentRouter } from "./agentRouter.ts";

const messageId = asMessageId("m");
const claude = scriptedAgent([{ type: "text_delta", messageId, delta: "claude" }]);
const mock = scriptedAgent([{ type: "text_delta", messageId, delta: "mock" }]);
const router = new AgentRouter({ "claude-headless": claude }, mock);

const modelOf = (provider: ModelInfo["provider"]): ModelInfo => ({
  id: asModelId(provider),
  label: provider,
  provider,
  description: "",
  capabilities: { thinking: false, toolUse: false },
  available: true,
});
const runFor = (provider: ModelInfo["provider"]) =>
  collect(router.run({ request: { modelId: asModelId(provider), messages: [] }, model: modelOf(provider), signal: new AbortController().signal }));

describe("AgentRouter", () => {
  it("sends claude-headless to the Claude agent", async () => {
    expect(await runFor("claude-headless")).toEqual([{ type: "text_delta", messageId, delta: "claude" }]);
  });

  it.each(["gemini", "groq", "openrouter"] as const)("falls back to the mock for %s", async (provider) => {
    expect(await runFor(provider)).toEqual([{ type: "text_delta", messageId, delta: "mock" }]);
  });
});
