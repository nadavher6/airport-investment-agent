import { describe, expect, it } from "vitest";
import { assembleRequest, buildMemorySystemBlock, selectFocusedRecords } from "./assemble.ts";
import type { AirportRecord } from "./types.ts";
import type { LlmMessage } from "../../llm/llmClient.ts";

const rec = (airportCode: string, extra: Partial<AirportRecord> = {}): AirportRecord => ({
  airportCode,
  ...extra,
});

const workingSet = new Map<string, AirportRecord>([
  ["LAX", rec("LAX", { enplanements: { cy2024: 38_000_000 } })],
  ["SFO", rec("SFO", { enplanements: { cy2024: 25_000_000 } })],
  ["DEN", rec("DEN", { enplanements: { cy2024: 2_100_000 } })],
]);

describe("selectFocusedRecords", () => {
  it("returns records in code order, skipping ones with no data", () => {
    const out = selectFocusedRecords(workingSet, ["DEN", "ZZZ", "LAX"]);
    expect(out.map((r) => r.airportCode)).toEqual(["DEN", "LAX"]);
  });

  it("caps at K even when more codes are focused", () => {
    const big = new Map(workingSet);
    big.set("ORD", rec("ORD"));
    big.set("ATL", rec("ATL"));
    const out = selectFocusedRecords(big, ["LAX", "SFO", "DEN", "ORD", "ATL"], 4);
    expect(out).toHaveLength(4);
  });

  it("applies field projection when given", () => {
    const out = selectFocusedRecords(workingSet, ["DEN"], 4, (r) => ({ airportCode: r.airportCode }));
    expect(out).toEqual([{ airportCode: "DEN" }]);
  });
});

describe("buildMemorySystemBlock", () => {
  it("returns the prompt unchanged when there is nothing to inject", () => {
    expect(buildMemorySystemBlock("SYS", {})).toBe("SYS");
    expect(buildMemorySystemBlock("SYS", { focusedRecords: [] })).toBe("SYS");
  });

  it("injects the rolling summary and the focused data block", () => {
    const block = buildMemorySystemBlock("SYS", {
      rollingSummary: "Compared LAX, SFO, DEN; LAX ranked highest.",
      focusedRecords: [rec("DEN", { enplanements: { cy2024: 2_100_000 } })],
    });
    expect(block).toContain("SYS");
    expect(block).toContain("## Conversation memory");
    expect(block).toContain("LAX ranked highest");
    expect(block).toContain("## Airport data in focus");
    expect(block).toContain('"DEN"');
    expect(block).toContain("2100000");
  });
});

describe("assembleRequest", () => {
  const history: LlmMessage[] = [
    { role: "user", content: "Compare LAX and SFO" },
    { role: "assistant", content: "LAX 61.3 vs SFO 50.9" },
    { role: "user", content: "why is it higher?" },
    { role: "assistant", content: "LAX is over capacity" },
    { role: "user", content: "and the second one's unmet demand?" },
  ];

  it("keeps the latest user message and windows older turns", () => {
    const { messages } = assembleRequest({ systemPrompt: "SYS", history, windowTurns: 3 });
    expect(messages).toHaveLength(3);
    expect(messages.at(-1)).toEqual({ role: "user", content: "and the second one's unmet demand?" });
  });

  it("starts the window on a user message when the slice would start on an assistant turn", () => {
    const nine: LlmMessage[] = [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
      { role: "assistant", content: "a3" },
      { role: "user", content: "u4" },
      { role: "assistant", content: "a4" },
      { role: "user", content: "u5" },
    ];
    const { messages } = assembleRequest({ systemPrompt: "SYS", history: nine });
    expect(messages[0]).toEqual({ role: "user", content: "u2" });
    expect(messages).toHaveLength(7);
    expect(messages.at(-1)).toEqual({ role: "user", content: "u5" });
    const even = assembleRequest({ systemPrompt: "SYS", history, windowTurns: 4 }).messages;
    expect(even[0]?.role).toBe("user");
  });

  it("puts memory in the system seam and never in the dialogue messages", () => {
    const { system, messages } = assembleRequest({
      systemPrompt: "SYS",
      history,
      rollingSummary: "Discussed LAX, SFO.",
      focusedRecords: [rec("DEN", { enplanements: { cy2024: 2_100_000 } })],
    });
    expect(system).toContain("## Airport data in focus");
    for (const m of messages) expect(m.content).not.toContain("Airport data in focus");
  });

  it("produces a lean request (no memory block) when nothing is focused", () => {
    const { system } = assembleRequest({ systemPrompt: "SYS", history });
    expect(system).toBe("SYS");
  });
});
