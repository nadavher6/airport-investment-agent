import { describe, expect, it } from "vitest";
import { looksLikeToolCall, parseModelStep } from "./toolCall.ts";

describe("parseModelStep", () => {
  it("reads a bare call", () => {
    expect(parseModelStep('{"tool":"get_enplanements","input":{"airport_code":"BOS"}}')).toEqual({
      kind: "call",
      call: { name: "get_enplanements", input: { airport_code: "BOS" } },
    });
  });

  it("reads a call in a ```json fence and a call after a lead-in", () => {
    const fenced = parseModelStep('```json\n{"tool":"get_enplanements","input":{"airport_code":"BOS"}}\n```');
    const prefaced = parseModelStep('Let me check.\n{"tool":"get_enplanements","input":{"airport_code":"BOS"}}');
    expect(fenced).toEqual({ kind: "call", call: { name: "get_enplanements", input: { airport_code: "BOS" } } });
    expect(prefaced).toEqual(fenced);
  });

  it("treats plain prose as the answer", () => {
    expect(parseModelStep("Boston handled about 20M passengers.")).toEqual({ kind: "answer" });
    expect(looksLikeToolCall("A set like {a, b} in prose")).toBe(false);
  });

  it("unparseable: truncated or broken JSON", () => {
    const truncated = parseModelStep('{"tool":"get_enplanements","input":{"airport_code":"BO');
    const broken = parseModelStep("{tool: get_enplanements}");
    expect(truncated).toMatchObject({ kind: "error", error: { code: "unparseable" } });
    expect(broken).toMatchObject({ kind: "error", error: { code: "unparseable" } });
  });

  it.each([
    ['{"tool":"x"}', 'missing key "input"'],
    ['{"input":{}}', 'missing key "tool"'],
    ['{"tool":"x","input":{},"extra":1}', 'unexpected key "extra"'],
    ['{"tool":5,"input":{}}', '"tool" must be a non-empty string'],
    ['{"tool":"x","input":[1]}', '"input" must be a JSON object'],
  ])("bad_shape: %s", (text, problem) => {
    const step = parseModelStep(text);
    expect(step.kind).toBe("error");
    if (step.kind !== "error") return;
    expect(step.error.code).toBe("bad_shape");
    if (step.error.code !== "bad_shape") return;
    expect(step.error.problem).toContain(problem);
  });

  it("keeps the tool name of a bad_shape call when it was a string", () => {
    expect(parseModelStep('{"tool":"get_enplanements","input":"BOS"}')).toMatchObject({
      error: { code: "bad_shape", tool: "get_enplanements" },
    });
  });

  it("truncates the quoted raw text", () => {
    const step = parseModelStep(`{"tool": "${"x".repeat(5000)}`);
    expect(step.kind === "error" && step.error.code === "unparseable" && step.error.raw.length).toBeLessThanOrEqual(601);
  });
});
