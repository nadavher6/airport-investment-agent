/**
 * Monitor one prompt end-to-end through the real agent, printing every event
 * (classification, each tool call + result, thinking, and the final answer).
 * Run: npx tsx src/eval/monitor.ts "Compare LA and Santa Ana airport congestion levels."
 */
import { homedir } from "node:os";
import { asModelId, type AgentEvent, type ModelInfo, type ModelProvider } from "@airport/shared";
import { LlmPassthroughAgent } from "../agent/llmPassthroughAgent.ts";
import { loadConfig } from "../config.ts";
import { ClaudeHeadlessClient } from "../llm/claude/claudeHeadlessClient.ts";
import type { LlmClient } from "../llm/llmClient.ts";

const prompt = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "Compare LA and Santa Ana airport congestion levels.";

async function main(): Promise<void> {
  const config = loadConfig();
  const claude = new ClaudeHeadlessClient({ config: config.claude, home: homedir(), ...(process.env.CLAUDE_CONFIG_DIR ? { configDir: process.env.CLAUDE_CONFIG_DIR } : {}) });
  const unused: LlmClient = { provider: "gemini", health: async () => ({ status: "unavailable", detail: "n/a" }), stream: () => { throw new Error("gemini unused"); } };
  const clients: Record<ModelProvider, LlmClient> = { "claude-headless": claude, gemini: unused };
  const model: ModelInfo = { id: asModelId("monitor"), label: "monitor", provider: "claude-headless", description: "", capabilities: { thinking: true, toolUse: false }, available: true };

  console.log(`\nPROMPT: ${prompt}\n${"=".repeat(70)}`);
  const agent = new LlmPassthroughAgent(clients, config.claude.model);
  const callName = new Map<string, string>();
  let answer = "";

  for await (const e of agent.run({ request: { modelId: model.id, messages: [{ role: "user", content: prompt }] }, model, signal: new AbortController().signal }) as AsyncIterable<AgentEvent>) {
    if (e.type === "message_start") console.log("▶ message_start");
    else if (e.type === "tool_call") {
      callName.set(e.toolCallId, e.name);
      console.log(`\n🔧 TOOL CALL: ${e.name}\n   input: ${JSON.stringify(e.input)}`);
    } else if (e.type === "tool_result") {
      const name = callName.get(e.toolCallId) ?? "?";
      const body = e.result.ok ? JSON.stringify(e.result.output) : `ERROR: ${e.result.errorMessage}`;
      console.log(`   ↳ ${name} result (${e.result.ok ? "ok" : "fail"}): ${body.length > 1400 ? body.slice(0, 1400) + "…[truncated]" : body}`);
    } else if (e.type === "thinking_delta") process.stdout.write(".");
    else if (e.type === "text_delta") answer += e.delta;
    else if (e.type === "error") console.log(`\n❌ ERROR: ${e.error.message}`);
    else if (e.type === "message_end") {
      console.log(`\n${"=".repeat(70)}\n💬 FINAL ANSWER:\n${"=".repeat(70)}\n${answer}\n${"=".repeat(70)}\n[stop: ${e.stopReason}]`);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
