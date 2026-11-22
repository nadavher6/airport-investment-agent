/**
 * Eval runner (tasks/07-eval-pipeline.md). Runs each case in cases.ts through the REAL agent,
 * captures the tool trace + answer, and writes one Markdown transcript per case plus an index and
 * grading instructions. A Claude session then reads eval-results/ and produces the HTML scorecard.
 *
 * Run: npx tsx src/eval/run.ts [--group=G4-single] [--id=single-bos-growth] [--limit=3] [--model=sonnet]
 */
import { homedir } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { asModelId, type AgentEvent, type ModelInfo, type ModelProvider } from "@airport/shared";
import { LlmPassthroughAgent } from "../agent/llmPassthroughAgent.ts";
import { loadConfig } from "../config.ts";
import { ClaudeHeadlessClient } from "../llm/claude/claudeHeadlessClient.ts";
import type { LlmClient, LlmMessage } from "../llm/llmClient.ts";
import { EVAL_CASES, type EvalCase } from "./cases.ts";
import { GRADING_MD } from "./grading.ts";

const argOf = (flag: string): string | undefined => process.argv.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1];

interface ToolCall { readonly name: string; readonly input: unknown }
interface ToolResult { readonly name: string; readonly ok: boolean; readonly output: unknown; readonly error?: string }
interface TurnTrace {
  readonly user: string;
  readonly classification?: string;
  readonly tools: ToolCall[];
  readonly results: ToolResult[];
  readonly answer: string;
  readonly errored?: string;
}

async function collect(gen: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

/** Pull the gradeable trace out of one turn's event stream. */
function traceOf(user: string, events: AgentEvent[]): TurnTrace {
  const callById = new Map<string, { name: string; input: unknown }>();
  const tools: ToolCall[] = [];
  const results: ToolResult[] = [];
  let classification: string | undefined;
  let answer = "";
  let errored: string | undefined;

  for (const e of events) {
    if (e.type === "tool_call") callById.set(e.toolCallId, { name: e.name, input: e.input });
    else if (e.type === "tool_result") {
      const call = callById.get(e.toolCallId);
      const name = call?.name ?? "?";
      if (name === "classify_message") {
        classification = e.result.ok ? (e.result.output as { label?: string }).label : undefined;
      } else {
        if (call) tools.push({ name, input: call.input });
        results.push(e.result.ok ? { name, ok: true, output: e.result.output } : { name, ok: false, output: null, error: e.result.errorMessage });
      }
    } else if (e.type === "text_delta") answer += e.delta;
    else if (e.type === "error") errored = e.error.message;
  }
  return { user, ...(classification ? { classification } : {}), tools, results, answer: answer.trim(), ...(errored ? { errored } : {}) };
}

async function runCase(agent: LlmPassthroughAgent, model: ModelInfo, c: EvalCase): Promise<TurnTrace[]> {
  const history: LlmMessage[] = [];
  const traces: TurnTrace[] = [];
  for (const turn of c.turns) {
    const messages: LlmMessage[] = [...history, { role: "user", content: turn }];
    const events = await collect(agent.run({ request: { modelId: model.id, messages }, model, signal: new AbortController().signal }));
    const t = traceOf(turn, events);
    traces.push(t);
    history.push({ role: "user", content: turn }, { role: "assistant", content: t.answer });
  }
  return traces;
}

const summarize = (v: unknown, max = 600): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
};

function caseMarkdown(c: EvalCase, traces: TurnTrace[]): string {
  const lines: string[] = [
    `# ${c.id}`,
    "",
    `- **Group:** ${c.group}`,
    `- **Turns:** ${c.turns.length}`,
    "",
    "## Expected (rubric for the judge)",
    "```json",
    JSON.stringify(c.expect, null, 2),
    "```",
    "",
    "## Transcript (what the agent actually did)",
  ];
  traces.forEach((t, i) => {
    lines.push(
      "",
      `### Turn ${i + 1}`,
      `**User:** ${t.user}`,
      "",
      `- **Classified as:** ${t.classification ?? "(n/a)"}`,
      `- **Tools called:** ${t.tools.length === 0 ? "(none)" : t.tools.map((x) => `\`${x.name}(${summarize(x.input, 120)})\``).join(", ")}`,
    );
    for (const r of t.results) lines.push(`  - ${r.name} → ${r.ok ? "ok" : `error: ${r.error}`}: ${summarize(r.ok ? r.output : r.error, 400)}`);
    if (t.errored) lines.push(`- **Stream error:** ${t.errored}`);
    lines.push("", "**Agent answer:**", "", t.answer || "_(empty)_");
  });
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const claude = new ClaudeHeadlessClient({ config: config.claude, home: homedir(), ...(process.env.CLAUDE_CONFIG_DIR ? { configDir: process.env.CLAUDE_CONFIG_DIR } : {}) });
  const unused: LlmClient = { provider: "gemini", health: async () => ({ status: "unavailable", detail: "eval runs claude-headless only" }), stream: () => { throw new Error("gemini not used in eval"); } };
  const clients: Record<ModelProvider, LlmClient> = { "claude-headless": claude, gemini: unused };
  const claudeModel = argOf("model") ?? config.claude.model;
  const model: ModelInfo = { id: asModelId("eval-claude"), label: "eval", provider: "claude-headless", description: "", capabilities: { thinking: true, toolUse: false }, available: true };

  let cases = [...EVAL_CASES];
  const group = argOf("group");
  const id = argOf("id");
  const limit = argOf("limit");
  if (group) cases = cases.filter((c) => c.group === group);
  if (id) cases = cases.filter((c) => c.id === id);
  if (limit) cases = cases.slice(0, Number(limit));

  const outDir = resolve(fileURLToPath(import.meta.url), "../../../../../eval-results");
  mkdirSync(resolve(outDir, "cases"), { recursive: true });
  writeFileSync(resolve(outDir, "GRADING.md"), GRADING_MD);

  const index: string[] = ["# Eval run", "", `Ran ${cases.length} case(s) on ${new Date().toISOString().slice(0, 16).replace("T", " ")} with claude-headless (${claudeModel ?? "default"}).`, "", "| Case | Group | Turns | Tools used |", "|---|---|---|---|"];

  for (const c of cases) {
    process.stdout.write(`running ${c.id} … `);
    const agent = new LlmPassthroughAgent(clients, claudeModel); // fresh agent per case so memory is per-conversation
    try {
      const traces = await runCase(agent, model, c);
      writeFileSync(resolve(outDir, "cases", `${c.id}.md`), caseMarkdown(c, traces));
      const toolsUsed = [...new Set(traces.flatMap((t) => t.tools.map((x) => x.name)))].join(", ") || "(none)";
      index.push(`| [${c.id}](cases/${c.id}.md) | ${c.group} | ${c.turns.length} | ${toolsUsed} |`);
      console.log("done");
    } catch (err) {
      console.log(`FAILED: ${(err as Error).message}`);
      index.push(`| ${c.id} | ${c.group} | - | RUN ERROR: ${(err as Error).message} |`);
    }
  }

  writeFileSync(resolve(outDir, "INDEX.md"), `${index.join("\n")}\n`);
  console.log(`\nWrote ${cases.length} transcript(s) to ${outDir}. Point a Claude session at it and follow GRADING.md.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
