/**
 * Eval runner (tasks/07-eval-pipeline.md). Runs each case in cases.ts through the REAL agent,
 * captures the tool trace + answer, and writes one Markdown transcript per case plus an index and
 * grading instructions. A Claude session then reads eval-results/ and produces the HTML scorecard.
 *
 * Run: npx tsx src/eval/run.ts [--group=G4-single] [--id=single-bos-growth] [--limit=3] [--model=sonnet] [--timeout-sec=300]
 *
 * Strict CLI: unknown flags, a non-positive-integer --limit, an unmatched --group/--id, or 0 selected cases exit 2.
 * Each case gets its own conversationId (shared by its turns) and a wall-clock timeout of 300 s by default
 * (DEFAULT_CASE_TIMEOUT_MS in cli.ts, --timeout-sec to override). Ctrl-C aborts the current case and exits 130;
 * INDEX.md is rewritten after every case, so a partial run still has an index.
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
import { newConversationId, parseEvalArgs, selectCases, type EvalArgs } from "./cli.ts";
import { GRADING_MD } from "./grading.ts";


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

async function runCase(agent: LlmPassthroughAgent, model: ModelInfo, c: EvalCase, signal: AbortSignal): Promise<TurnTrace[]> {
  const history: LlmMessage[] = [];
  const traces: TurnTrace[] = [];
  const conversationId = newConversationId(); // one id per case, reused by every turn so the agent's memory is exercised
  for (const turn of c.turns) {
    if (signal.aborted) break;
    const messages: LlmMessage[] = [...history, { role: "user", content: turn }];
    const events = await collect(agent.run({ request: { modelId: model.id, messages, conversationId }, model, signal }));
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
  let args: EvalArgs;
  try {
    args = parseEvalArgs(process.argv.slice(2));
    selectCases(EVAL_CASES, args); // fail fast, before any model call
  } catch (err) {
    console.error(`eval: ${(err as Error).message}`);
    process.exit(2);
  }
  const config = loadConfig();
  const claude = new ClaudeHeadlessClient({ config: config.claude, home: homedir(), ...(process.env.CLAUDE_CONFIG_DIR ? { configDir: process.env.CLAUDE_CONFIG_DIR } : {}) });
  const unused: LlmClient = { provider: "gemini", health: async () => ({ status: "unavailable", detail: "eval runs claude-headless only" }), stream: () => { throw new Error("gemini not used in eval"); } };
  const clients: Record<ModelProvider, LlmClient> = { "claude-headless": claude, gemini: unused };
  const claudeModel = args.model ?? config.claude.model;
  const model: ModelInfo = { id: asModelId("eval-claude"), label: "eval", provider: "claude-headless", description: "", capabilities: { thinking: true, toolUse: false }, available: true };

  const cases = selectCases(EVAL_CASES, args);

  const outDir = resolve(fileURLToPath(import.meta.url), "../../../../../eval-results");
  mkdirSync(resolve(outDir, "cases"), { recursive: true });
  writeFileSync(resolve(outDir, "GRADING.md"), GRADING_MD);

  const index: string[] = ["# Eval run", "", `Selected ${cases.length} case(s) on ${new Date().toISOString().slice(0, 16).replace("T", " ")} with claude-headless (${claudeModel ?? "default"}); rows are added as each case finishes.`, "", "| Case | Group | Turns | Tools used |", "|---|---|---|---|"];
  const writeIndex = (): void => writeFileSync(resolve(outDir, "INDEX.md"), `${index.join("\n")}\n`);
  writeIndex();

  // Ctrl-C aborts the current case, then we stop with what is done (INDEX.md is already up to date).
  const sigint = new AbortController();
  process.once("SIGINT", () => sigint.abort());

  let interrupted = false;
  for (const c of cases) {
    if (sigint.signal.aborted) { interrupted = true; break; }
    process.stdout.write(`running ${c.id} … `);
    const agent = new LlmPassthroughAgent(clients, claudeModel); // fresh agent per case so memory is per-conversation
    const timeout = AbortSignal.timeout(args.timeoutMs);
    try {
      const traces = await runCase(agent, model, c, AbortSignal.any([timeout, sigint.signal]));
      if (sigint.signal.aborted) throw new Error("interrupted (SIGINT)");
      if (timeout.aborted) throw new Error(`timed out after ${args.timeoutMs / 1000}s`);
      writeFileSync(resolve(outDir, "cases", `${c.id}.md`), caseMarkdown(c, traces));
      const toolsUsed = [...new Set(traces.flatMap((t) => t.tools.map((x) => x.name)))].join(", ") || "(none)";
      const flags = traces.some((t) => t.errored) ? " STREAM ERROR" : traces.some((t) => t.answer === "") ? " EMPTY ANSWER" : "";
      index.push(`| [${c.id}](cases/${c.id}.md) | ${c.group} | ${c.turns.length} | ${toolsUsed}${flags} |`);
      console.log(`done${flags}`);
    } catch (err) {
      const message = sigint.signal.aborted ? "interrupted (SIGINT)" : timeout.aborted ? `timed out after ${args.timeoutMs / 1000}s` : (err as Error).message;
      console.log(`FAILED: ${message}`);
      index.push(`| ${c.id} | ${c.group} | - | RUN ERROR: ${message} |`);
      if (sigint.signal.aborted) interrupted = true;
    }
    writeIndex();
    if (interrupted) break;
  }

  console.log(`\nWrote ${index.length - 6} of ${cases.length} case row(s) to ${outDir}. Point a Claude session at it and follow GRADING.md.`);
  if (interrupted) process.exit(130);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
