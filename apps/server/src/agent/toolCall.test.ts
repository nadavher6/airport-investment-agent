import { describe, expect, it } from "vitest";
import { looksLikeToolCall, parseModelStep } from "./toolCall.ts";

const CALL = '{"tool":"get_enplanements","input":{"airport_code":"BOS"}}';
const BOS = { name: "get_enplanements", input: { airport_code: "BOS" } };

describe("parseModelStep (#48, #49)", () => {
  it("reads a bare call", () => {
    expect(parseModelStep(CALL)).toEqual({ kind: "call", call: BOS, extra: false });
  });

  it("reads a call in a ```json fence, after a lead-in, and before trailing prose", () => {
    expect(parseModelStep("```json\n" + CALL + "\n```")).toEqual({ kind: "call", call: BOS, extra: false });
    expect(parseModelStep(`Let me check.\n${CALL}`)).toEqual({ kind: "call", call: BOS, extra: false });
    expect(parseModelStep(`Let me check.\n${CALL}\nOne moment.`)).toMatchObject({ kind: "call", call: BOS });
  });

  it("treats prose with no tool call as the answer, even with braces in it", () => {
    expect(parseModelStep("Boston handled about 20M passengers.")).toEqual({ kind: "answer" });
    expect(parseModelStep("BOS had 20.4M boardings in 2024 {approx}.")).toEqual({ kind: "answer" });
    expect(looksLikeToolCall("A set like {a, b} in prose")).toBe(false);
  });

  it("unparseable: truncated or broken JSON", () => {
    expect(parseModelStep('{"tool":"get_enplanements","input":{"airport_code":"BO')).toMatchObject({
      kind: "error",
      error: { code: "unparseable" },
    });
    expect(parseModelStep("{tool: get_enplanements}")).toMatchObject({ kind: "error", error: { code: "unparseable" } });
    expect(parseModelStep("{'tool': 'get_enplanements'}")).toMatchObject({ kind: "error", error: { code: "unparseable" } });
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

  it("reads only the first of several calls and says there were more", () => {
    const two = `${CALL}\n{"tool":"get_enplanements","input":{"airport_code":"LAX"}}`;
    expect(parseModelStep(two)).toEqual({ kind: "call", call: BOS, extra: true });
  });

  it("does not let a brace inside a string end the object early", () => {
    expect(parseModelStep('{"tool":"find_airports_by_city","input":{"cities":["a}b"]}}')).toMatchObject({
      kind: "call",
      call: { input: { cities: ["a}b"] } },
    });
  });

  it("truncates the quoted raw text", () => {
    const step = parseModelStep(`{"tool": "${"x".repeat(5000)}`);
    expect(step.kind === "error" && step.error.code === "unparseable" && step.error.raw.length).toBeLessThanOrEqual(601);
  });
});
