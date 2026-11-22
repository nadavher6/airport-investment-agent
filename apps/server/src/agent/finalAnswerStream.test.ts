import { describe, expect, it } from "vitest";
import { parseFinalAnswer, renderAnswer } from "./finalAnswer.ts";
import { FinalAnswerStream } from "./finalAnswerStream.ts";

const known = (code: string): boolean => ["ATL", "LAX"].includes(code);

/** Feed `text` in chunks of `size`; returns each non-empty release and the stream. */
function feed(text: string, size: number) {
  const stream = new FinalAnswerStream(known);
  const releases: Array<{ at: number; text: string }> = [];
  for (let i = 0; i < text.length; i += size) {
    const out = stream.push(text.slice(i, i + size));
    if (out !== "") releases.push({ at: i + size, text: out });
  }
  return { stream, releases };
}

const VALID = JSON.stringify({
  kind: "final_answer",
  answer: { airports: ["ATL"], caveats: ["2024 data."], summary: "ATL leads.", markdown: 'Line "one" \\ ok\n\n```chart\n{"a":1}\n```\nEmoji 😀 é' },
});

describe("FinalAnswerStream (#63)", () => {
  it.each([1, 3, 7, 64, 10_000])("chunks of %i: the release is a prefix of the rendered answer, and arrives before the JSON closes", (size) => {
    const { stream, releases } = feed(VALID, size);
    const parsed = parseFinalAnswer(VALID, known);
    if (!parsed.ok) throw new Error("fixture must be valid");
    const rendered = renderAnswer(parsed.answer);
    expect(rendered.startsWith(stream.emitted)).toBe(true);
    expect(stream.emitted).toContain("**ATL leads.**\n\n");
    expect(stream.emitted).not.toContain('"kind"');
    if (size < VALID.length) expect(releases[0]!.at).toBeLessThan(VALID.length);
  });

  it("never splits a surrogate pair", () => {
    const { releases } = feed(VALID, 1);
    for (const r of releases) expect(/[\uD800-\uDBFF]$/.test(r.text)).toBe(false);
  });

  it("releases the summary only once its string closed and the markdown has begun", () => {
    const stream = new FinalAnswerStream(known);
    expect(stream.push('{"kind":"final_answer","answer":{"summary":"Half')).toBe("");
    expect(stream.push(' done.","markdown":"')).toBe("");
    expect(stream.push("Bo")).toBe("**Half done.**\n\nBo");
    expect(stream.push('dy"}}')).toBe("dy");
  });

  const silent: ReadonlyArray<readonly [string, string]> = [
    ["a tool call", '{"tool":"get_airport_by_code","input":{"code":"ATL"}}'],
    ["prose", "ATL is big."],
    ["prose before the JSON", 'Sure: {"kind":"final_answer","answer":{"summary":"S","markdown":"M"}}'],
    ["the wrong kind", '{"kind":"answer","answer":{"summary":"S","markdown":"M"}}'],
    ["kind after answer", '{"answer":{"summary":"S","markdown":"M"},"kind":"final_answer"}'],
    ["an unknown key before the summary", '{"kind":"final_answer","answer":{"note":"x","summary":"S","markdown":"M"}}'],
    ["an unknown airport before the summary", '{"kind":"final_answer","answer":{"airports":["ZZZ"],"summary":"S","markdown":"M"}}'],
    ["an over-limit summary", `{"kind":"final_answer","answer":{"summary":"${"x".repeat(401)}","markdown":"M"}}`],
    ["broken JSON", "{kind: final_answer, answer: {summary: S}}"],
    ["a missing markdown", '{"kind":"final_answer","answer":{"summary":"S"}}'],
  ];
  it.each(silent)("%s releases nothing", (_name, text) => {
    expect(feed(text, 5).stream.emitted).toBe("");
  });
});
