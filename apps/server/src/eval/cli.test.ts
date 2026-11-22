import { describe, expect, it } from "vitest";
import { validateChatRequest } from "../http/validateChatRequest.ts";
import { EVAL_CASES } from "./cases.ts";
import { DEFAULT_CASE_TIMEOUT_MS, newConversationId, parseEvalArgs, selectCases } from "./cli.ts";

describe("parseEvalArgs", () => {
  it("parses valid flags, keeping '=' inside values", () => {
    expect(parseEvalArgs(["--limit=3", "--id=a=b", "--timeout-sec=10"])).toEqual({ limit: 3, id: "a=b", timeoutMs: 10_000 });
    expect(parseEvalArgs([]).timeoutMs).toBe(DEFAULT_CASE_TIMEOUT_MS);
  });
  it.each(["0", "-1", "abc", "1.5", "", "1e3"])("rejects --limit=%s", (v) => {
    expect(() => parseEvalArgs([`--limit=${v}`])).toThrow(/positive integer/);
  });
  it("rejects unknown or malformed flags", () => {
    expect(() => parseEvalArgs(["--bogus=1"])).toThrow(/unknown/);
    expect(() => parseEvalArgs(["--limit"])).toThrow(/unknown/);
  });
});

describe("selectCases", () => {
  it("selects with --id and --limit", () => {
    const first = EVAL_CASES[0]!;
    expect(selectCases(EVAL_CASES, { id: first.id, timeoutMs: 1 })).toEqual([first]);
    expect(selectCases(EVAL_CASES, { limit: 2, timeoutMs: 1 })).toHaveLength(2);
  });
  it("errors on an unmatched --id or --group", () => {
    expect(() => selectCases(EVAL_CASES, { id: "nope", timeoutMs: 1 })).toThrow(/matches no case/);
    expect(() => selectCases(EVAL_CASES, { group: "nope", timeoutMs: 1 })).toThrow(/matches no case/);
  });
  it("errors when 0 cases are selected", () => {
    expect(() => selectCases([], { timeoutMs: 1 })).toThrow(/0 cases selected/);
  });
});

describe("newConversationId", () => {
  it("is accepted by the server's #50 validation and differs per case", () => {
    const a = newConversationId();
    const b = newConversationId();
    expect(a).toMatch(/^eval-[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
    const body = { modelId: "m", messages: [{ role: "user", content: "hi" }], conversationId: a };
    expect(validateChatRequest(body).conversationId).toBe(a);
  });
});
