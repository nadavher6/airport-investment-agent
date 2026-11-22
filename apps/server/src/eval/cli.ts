/** Pure helpers for the eval runner (no side effects on import, so they are unit-tested). */
import { randomUUID } from "node:crypto";
import { asConversationId, type ConversationId } from "@airport/shared";
import type { EvalCase } from "./cases.ts";

/** Default per-case wall-clock budget (all turns of one case). Override with --timeout-sec=N. */
export const DEFAULT_CASE_TIMEOUT_MS = 300_000;

export interface EvalArgs {
  readonly group?: string;
  readonly id?: string;
  readonly limit?: number;
  readonly model?: string;
  readonly timeoutMs: number;
}

const KNOWN = ["group", "id", "limit", "model", "timeout-sec"] as const;
const POSITIVE_INT = /^[1-9][0-9]*$/;

/** Strict parse of `--flag=value` args. Throws an Error with a clear message on anything unknown or malformed. */
export function parseEvalArgs(argv: readonly string[]): EvalArgs {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!m || !(KNOWN as readonly string[]).includes(m[1]!)) throw new Error(`unknown or malformed argument "${arg}" (expected --${KNOWN.join("=… --")}=…)`);
    values.set(m[1]!, m[2]!); // m[2] keeps any further "=" in the value
  }
  const positive = (flag: string): number | undefined => {
    const raw = values.get(flag);
    if (raw === undefined) return undefined;
    if (!POSITIVE_INT.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error(`--${flag} must be a positive integer, got "${raw}"`);
    return Number(raw);
  };
  const limit = positive("limit");
  const timeoutSec = positive("timeout-sec");
  const group = values.get("group");
  const id = values.get("id");
  const model = values.get("model");
  return {
    ...(group !== undefined ? { group } : {}),
    ...(id !== undefined ? { id } : {}),
    ...(limit !== undefined ? { limit } : {}),
    ...(model !== undefined ? { model } : {}),
    timeoutMs: timeoutSec !== undefined ? timeoutSec * 1000 : DEFAULT_CASE_TIMEOUT_MS,
  };
}

/** Applies --group/--id/--limit. Throws when nothing matches (an unmatched --id or --group, or 0 selected). */
export function selectCases(all: readonly EvalCase[], args: EvalArgs): EvalCase[] {
  let cases = [...all];
  if (args.group !== undefined) {
    cases = cases.filter((c) => c.group === args.group);
    if (cases.length === 0) throw new Error(`--group=${args.group} matches no case`);
  }
  if (args.id !== undefined) {
    cases = cases.filter((c) => c.id === args.id);
    if (cases.length === 0) throw new Error(`--id=${args.id} matches no case`);
  }
  if (args.limit !== undefined) cases = cases.slice(0, args.limit);
  if (cases.length === 0) throw new Error("0 cases selected");
  return cases;
}

/** One conversationId per case: "eval-" + uuid (41 chars of [A-Za-z0-9-], within #50's 16-64 rule). */
export const newConversationId = (): ConversationId => asConversationId(`eval-${randomUUID()}`);
