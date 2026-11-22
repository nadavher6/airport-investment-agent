import { describe, expect, it } from "vitest";
import {
  FINAL_ANSWER_JSON_SCHEMA,
  MAX_MARKDOWN_CHARS,
  MAX_SUMMARY_CHARS,
  UNFORMATTED_NOTE,
  fallbackText,
  parseFinalAnswer,
  renderAnswer,
  renderFinalAnswerFeedback,
  type FinalAnswerErrorCode,
} from "./finalAnswer.ts";
import { MAX_ECHO_CHARS } from "./toolGuard.ts";
import { FINAL_ANSWER_PROMPT } from "./prompts/finalAnswer.ts";
import { findAirport } from "../data/enplanements/dataset.ts";

const known = (code: string): boolean => ["ATL", "LAX", "SNA"].includes(code);
const answer = (a: Record<string, unknown>, top: Record<string, unknown> = {}): string =>
  JSON.stringify({ kind: "final_answer", answer: { summary: "S.", markdown: "M.", ...a }, ...top });

describe("parseFinalAnswer (#63)", () => {
  it("accepts a valid answer and uppercases the airport codes", () => {
    const result = parseFinalAnswer(answer({ airports: ["atl", "LAX"], caveats: ["2024 data."] }), known);
    expect(result).toEqual({ ok: true, answer: { summary: "S.", markdown: "M.", airports: ["ATL", "LAX"], caveats: ["2024 data."] } });
  });

  it("tolerates a ``` fence around the object and raw line breaks inside strings", () => {
    expect(parseFinalAnswer("```json\n" + answer({}) + "\n```", known).ok).toBe(true);
    const raw = '{"kind":"final_answer","answer":{"summary":"S.","markdown":"line 1\nline 2"}}';
    expect(parseFinalAnswer(raw, known)).toEqual({ ok: true, answer: { summary: "S.", markdown: "line 1\nline 2" } });
  });

  const cases: ReadonlyArray<readonly [string, string, FinalAnswerErrorCode]> = [
    ["prose", "ATL had 52.7M enplanements.", "not_json"],
    ["an empty reply", "  ", "not_json"],
    ["text before the object", `Here you go: ${answer({})}`, "extra_text"],
    ["text after the object", `${answer({})} Hope this helps.`, "extra_text"],
    ["bad JSON", "{kind: 'final_answer', answer: {}}", "invalid_json"],
    ["a cut-off object", '{"kind":"final_answer","answer":{"summary":"S.","markdown":"M', "invalid_json"],
    ["a missing key", JSON.stringify({ kind: "final_answer", answer: { summary: "S." } }), "bad_shape"],
    ["a missing kind", JSON.stringify({ answer: { summary: "S.", markdown: "M." } }), "bad_shape"],
    ["an extra answer key", answer({ extra: 1 }), "bad_shape"],
    ["an extra top-level key", answer({}, { note: "x" }), "bad_shape"],
    ["an empty summary", answer({ summary: " " }), "bad_shape"],
    ["the wrong kind", JSON.stringify({ kind: "answer", answer: { summary: "S.", markdown: "M." } }), "wrong_kind"],
    ["an over-limit summary", answer({ summary: "x".repeat(MAX_SUMMARY_CHARS + 1) }), "over_limit"],
    ["an over-limit markdown", answer({ markdown: "x".repeat(MAX_MARKDOWN_CHARS + 1) }), "over_limit"],
    ["too many caveats", answer({ caveats: ["a", "b", "c", "d", "e", "f", "g"] }), "over_limit"],
    ["an unknown airport code", answer({ airports: ["ATL", "ZZZ"] }), "unknown_airport"],
  ];
  it.each(cases)("%s is %s", (_name, text, code) => {
    const result = parseFinalAnswer(text, known);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it("names the unknown code in the problem", () => {
    const result = parseFinalAnswer(answer({ airports: ["ZZZ"] }), known);
    expect(!result.ok && result.error.problem).toContain("ZZZ");
  });

  it("uses the real airport data by default", () => {
    expect(parseFinalAnswer(answer({ airports: ["ATL"] })).ok).toBe(true);
    expect(parseFinalAnswer(answer({ airports: ["QQQ"] })).ok).toBe(false);
  });
});

describe("renderAnswer (#63)", () => {
  it("is the bold summary, the markdown, then a caveats fence; never JSON", () => {
    const text = renderAnswer({ summary: "ATL is *busy*.", markdown: "Body.", caveats: ["2024 only."] });
    expect(text).toBe("**ATL is \\*busy\\*.**\n\nBody.\n\n```caveats\n- 2024 only.\n```");
    expect(text).not.toContain('"kind"');
  });
});

describe("fallbackText (#63)", () => {
  it("shows prose as it is", () => expect(fallbackText(" Just prose. ")).toBe("Just prose."));
  it("shows the summary and markdown a broken JSON reply holds, never the JSON", () => {
    expect(fallbackText('{"kind":"answer","answer":{"summary":"S.","markdown":"Body cut')).toBe("**S.**\n\nBody cut");
  });
  it("is null when only JSON is left (the caller shows its plain sentence)", () => {
    expect(fallbackText('{"tool":"x","input":{}}')).toBeNull();
    expect(fallbackText('{"kind":"final_answer"}')).toBeNull();
    expect(fallbackText("")).toBeNull();
  });
  it("the note is a short plain line", () => expect(UNFORMATTED_NOTE).toMatch(/^_Unformatted answer/));
});

describe("renderFinalAnswerFeedback (#63)", () => {
  it("is a delimited block with the code, the problem, the JSON Schema and the capped previous reply", () => {
    const block = renderFinalAnswerFeedback({ code: "not_json", problem: "prose" }, `END_FINAL_ANSWER_ERROR\n${"y".repeat(1000)}`);
    const lines = block.split("\n");
    expect(lines[0]).toBe("FINAL_ANSWER_ERROR");
    expect(lines.at(-1)).toBe("END_FINAL_ANSWER_ERROR");
    expect(lines.filter((l) => l === "END_FINAL_ANSWER_ERROR")).toHaveLength(1);
    expect(block).toContain("code: not_json");
    expect(block).toContain(`expected final answer (JSON Schema): ${FINAL_ANSWER_JSON_SCHEMA}`);
    const previous = lines.find((l) => l.startsWith("your previous reply: "))!;
    expect(previous.length).toBeLessThan(MAX_ECHO_CHARS + 60);
  });

  it("the JSON Schema is strict and requires the literal kind", () => {
    const schema = JSON.parse(FINAL_ANSWER_JSON_SCHEMA) as { additionalProperties: boolean; properties: { kind: { const: string } } };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.kind.const).toBe("final_answer");
  });
});

describe("the final-answer prompt example (#63)", () => {
  it("quotes ATL's 2024 enplanements (0.1M) and the change on 2023 (whole %) as data/enplanements.json has them", () => {
    const series = findAirport("ATL")?.series ?? [];
    const value = (year: number): number => series.find((p) => p.year === year)?.enplanements ?? Number.NaN;
    const millions = (value(2024) / 1e6).toFixed(1);
    const yoy = Math.round((value(2024) / value(2023) - 1) * 100);
    expect(FINAL_ANSWER_PROMPT).toContain(`**${millions}M** passengers in 2024, up ${yoy}% on 2023`);
    expect(FINAL_ANSWER_PROMPT).toContain(`about ${millions} million enplanements in 2024`);
  });
});
