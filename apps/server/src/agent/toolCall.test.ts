import { describe, expect, it } from "vitest";
import { parseToolCall } from "./toolCall.ts";

const CALL = '{"tool":"get_enplanements","input":{"airport_code":"BOS"}}';

describe("parseToolCall (#48)", () => {
  it("reads a bare call", () => {
    expect(parseToolCall(CALL)).toEqual({ kind: "call", name: "get_enplanements", input: { airport_code: "BOS" }, extra: false });
  });

  it("reads a call in a ```json fence", () => {
    expect(parseToolCall("```json\n" + CALL + "\n```")).toMatchObject({ kind: "call", name: "get_enplanements" });
  });

  it("reads a call after a lead-in sentence and before trailing prose", () => {
    expect(parseToolCall(`Let me check.\n${CALL}\nOne moment.`)).toMatchObject({ kind: "call", input: { airport_code: "BOS" } });
  });

  it("treats prose with no tool key as the answer, even with braces in it", () => {
    expect(parseToolCall("BOS had 20.4M boardings in 2024 {approx}.")).toEqual({ kind: "answer" });
  });

  it("flags malformed or truncated JSON as bad", () => {
    expect(parseToolCall('{"tool":"get_enplanements","input":{"airport_code":"BOS"')).toEqual({ kind: "bad", reason: "the tool call was not valid JSON" });
    expect(parseToolCall("{'tool': 'get_enplanements'}")).toMatchObject({ kind: "bad" });
  });

  it("flags a non-string tool name and a non-object input as bad", () => {
    expect(parseToolCall('{"tool":42,"input":{}}')).toMatchObject({ kind: "bad" });
    expect(parseToolCall('{"tool":"get_enplanements","input":["BOS"]}')).toEqual({ kind: "bad", reason: 'the "input" field must be a JSON object' });
  });

  it("defaults a missing input to {} (the tool's schema then decides)", () => {
    expect(parseToolCall('{"tool":"get_airport_by_code"}')).toMatchObject({ kind: "call", input: {} });
  });

  it("runs only the first of several calls and says there were more", () => {
    const two = `${CALL}\n{"tool":"get_enplanements","input":{"airport_code":"LAX"}}`;
    expect(parseToolCall(two)).toEqual({ kind: "call", name: "get_enplanements", input: { airport_code: "BOS" }, extra: true });
  });

  it("does not let a brace inside a string end the object early", () => {
    expect(parseToolCall('{"tool":"find_airports_by_city","input":{"cities":["a}b"]}}')).toMatchObject({ kind: "call", input: { cities: ["a}b"] } });
  });
});
