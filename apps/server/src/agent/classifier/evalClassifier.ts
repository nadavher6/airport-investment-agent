/**
 * Manual eval (#26): runs the REAL classifier (classifyMessage with the real clients and the
 * classifier models from MODELS) over CLASSIFIER_EXAMPLES and prints expected vs got.
 * It makes paid/real LLM calls, so it is NOT a *.test.ts file and never runs in `npm test`.
 *
 *   cd apps/server
 *   node --env-file=../../.env --import tsx src/agent/classifier/evalClassifier.ts [claude-headless|gemini]... [--from=N] [--delay-ms=MS]
 *
 * With no provider both run. `--from=N` starts at example N (1-based, to finish a run that hit a quota);
 * `--delay-ms` waits between calls (Gemini's free tier allows only a few requests per minute). After the first failed call (for example a Gemini 429)
 * that provider stops: the rest of its examples are reported as "not run", never retried in a loop.
 */
import { homedir } from "node:os";
import { loadConfig } from "../../config.ts";
import { ClaudeHeadlessClient } from "../../llm/claude/claudeHeadlessClient.ts";
import { GeminiClient } from "../../llm/geminiClient.ts";
import type { LlmClient } from "../../llm/llmClient.ts";
import { MODELS } from "../../llm/models.ts";
import { classifyMessage } from "./classifier.ts";
import { CLASSIFIER_EXAMPLES } from "./examples.ts";

type Provider = LlmClient["provider"];

function makeClient(provider: Provider): LlmClient {
  const config = loadConfig();
  if (provider === "gemini") return new GeminiClient({ apiKey: config.gemini.apiKey });
  return new ClaudeHeadlessClient({
    config: config.claude,
    home: homedir(),
    ...(process.env.CLAUDE_CONFIG_DIR ? { configDir: process.env.CLAUDE_CONFIG_DIR } : {}),
  });
}

async function evalProvider(provider: Provider, from: number, delayMs: number): Promise<void> {
  const client = makeClient(provider);
  console.log(`\n## ${provider} (${MODELS[provider].classifier})\n`);
  console.log("| # | Message | Expected | Got | OK |");
  console.log("|---|---|---|---|---|");
  let correct = 0;
  let run = 0;
  let stopped: string | undefined;
  for (const [i, example] of CLASSIFIER_EXAMPLES.entries()) {
    let got: string;
    if (i + 1 < from) continue;
    if (stopped !== undefined) {
      got = "not run";
    } else {
      try {
        if (run > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
        const messages = [...(example.history ?? []), { role: "user" as const, content: example.message }];
        const result = await classifyMessage(client, messages, AbortSignal.timeout(60_000));
        got = result.label;
        run++;
        if (got === example.expected) correct++;
      } catch (err) {
        stopped = err instanceof Error ? err.message : "unknown error";
        got = `error: ${stopped}`;
      }
    }
    const shown = example.history ? `${example.message} (follow-up)` : example.message;
    console.log(`| ${i + 1} | ${shown} | ${example.expected} | ${got} | ${got === example.expected ? "yes" : "NO"} |`);
  }
  console.log(`\n${provider}: ${correct}/${run} correct of ${CLASSIFIER_EXAMPLES.length - Math.max(0, from - 1)} examples${stopped ? ` (stopped after an error: ${stopped})` : ""}`);
}

const args = process.argv.slice(2);
const option = (name: string): number => Number(args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? 0);
const requested = args.filter((a) => !a.startsWith("--"));
const providers: Provider[] = requested.length > 0 ? (requested as Provider[]) : ["claude-headless", "gemini"];
for (const provider of providers) {
  if (!(provider in MODELS)) throw new Error(`Unknown provider: ${provider}`);
  await evalProvider(provider, Math.max(1, option("from")), option("delay-ms"));
}
