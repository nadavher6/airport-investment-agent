import type { JsonValue, ToolUseBlock } from "@airport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolUseBlockView } from "../../components/blocks/ToolUseBlockView";
import { TOOL } from "../../test/fixtures";
import { SCORE_FIVE, SCORE_ONE, SCORE_THREE, SCORE_TWO } from "./fixtures";
import { CATEGORIES, formatScore, formatShare, missingText, parseScoreResult, type RankedAirport, type ScoreResult } from "./spec";

// The real ToolUseBlockView, as the chat draws a tool_use block; nothing is mocked.
const block = (output: JsonValue, name = "score_airports"): ToolUseBlock => ({
  type: "tool_use",
  toolCallId: TOOL,
  name,
  input: { airport_codes: ["LAX"] },
  status: "succeeded",
  output,
});

const checked = (f: JsonValue): ScoreResult => {
  const r = parseScoreResult(f);
  if (!r.ok) throw new Error(r.reason);
  return r.result;
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const rowCodes = (): string[] =>
  screen.getAllByTestId("score-row").map((r) => within(r).getByRole("button").textContent?.replace("▸", "") ?? "");

/** The generic card: the header button and the raw JSON under "Output", no score view. */
async function expectGeneric(output: JsonValue) {
  expect(screen.queryByTestId("score-view")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /score_airports/ }));
  expect(screen.getByText("Output")).toBeVisible();
  expect(screen.getByText((_t, el) => el?.tagName === "PRE" && el.textContent === JSON.stringify(output, null, 2))).toBeVisible();
}

describe("score_airports: 1 airport is a report", () => {
  const lax = checked(SCORE_ONE).ranking[0] as RankedAirport;

  it("shows the final score tile with coverage, the fixed-scale label (#75), and all 4 categories incl. the missing one", () => {
    render(<ToolUseBlockView block={block(SCORE_ONE)} />);
    const report = screen.getByRole("article", { name: "Score report: LAX" });
    expect(screen.getByText("Fixed scales on each airport's own numbers")).toBeInTheDocument();
    expect(within(report).getByLabelText(`Final score, ${formatScore(lax.score)}, / 100`)).toHaveClass("viz-kpi__tile");
    expect(within(report).getByLabelText("Coverage, 80%")).toHaveClass("viz-kpi__tile");
    const cats = within(report).getAllByTestId("score-category");
    expect(cats.map((c) => c.querySelector(".score-cat__label")?.textContent)).toEqual(
      CATEGORIES.map((k) => lax.breakdown[k].label),
    );
    const growth = cats[3] as HTMLElement;
    expect(growth).toHaveClass("score-cat--missing");
    expect(within(growth).getByText(missingText(lax.breakdown.growth))).toBeInTheDocument();
    expect(within(growth).getByText("No growth data available for this airport.")).toBeInTheDocument();
    expect(within(growth).queryByRole("meter")).toBeNull();
  });

  it("shows each category's numbers exactly as in the fixture, with its explanation and formula", () => {
    render(<ToolUseBlockView block={block(SCORE_ONE)} />);
    expect(screen.getByText("88")).toHaveClass("viz-kpi__value"); // the fixture's score: 88
    const cats = screen.getAllByTestId("score-category");
    (["congestion", "unmet_demand", "long_haul"] as const).forEach((key, i) => {
      const cat = lax.breakdown[key];
      const el = cats[i] as HTMLElement;
      expect(within(el).getByRole("meter")).toHaveAttribute("aria-valuenow", String(cat.subScore));
      expect(el.querySelector(".score-cat__value")?.textContent).toBe(String(cat.subScore));
      expect(within(el).getByText(`${String(cat.contribution)} pts`)).toBeInTheDocument();
      expect(within(el).getByText(formatShare(cat.weight))).toBeInTheDocument();
      expect(within(el).getByText(cat.evidence?.explanation ?? "")).toBeInTheDocument();
      expect(within(el).getByText(cat.evidence?.formula ?? "")).toHaveClass("score-cat__formula");
    });
    expect(lax.breakdown.congestion.subScore).toBe(88.4);
    expect(screen.getByText("88.4")).toBeInTheDocument();
  });

  it("keeps the raw JSON behind a Show data toggle inside the open card", async () => {
    render(<ToolUseBlockView block={block(SCORE_ONE)} />);
    const toggle = screen.getByRole("button", { name: "Show data" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/"airportCode": "LAX"/)).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide data" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/"airportCode": "LAX"/)).toBeVisible();
  });
});

describe("score_airports: the card collapses and expands (#58)", () => {
  const header = () => screen.getByRole("button", { name: /^score_airports/ });

  it("is open by default, with the score view visible", () => {
    render(<ToolUseBlockView block={block(SCORE_ONE)} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("score-view")).toBeVisible();
  });

  it("clicking the header collapses it, clicking again expands it; aria-expanded follows", async () => {
    render(<ToolUseBlockView block={block(SCORE_ONE)} />);
    await userEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("score-view")).not.toBeVisible();
    await userEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("score-view")).toBeVisible();
  });

  it("toggles with Enter and Space from the keyboard", async () => {
    render(<ToolUseBlockView block={block(SCORE_ONE)} />);
    header().focus();
    await userEvent.keyboard("{Enter}");
    expect(header()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("score-view")).not.toBeVisible();
    await userEvent.keyboard(" ");
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("score-view")).toBeVisible();
  });

  it("collapses the 2-airport and 3-airport views too", async () => {
    for (const output of [SCORE_TWO, SCORE_THREE]) {
      const { unmount } = render(<ToolUseBlockView block={block(output)} />);
      expect(screen.getByTestId("score-view")).toBeVisible();
      await userEvent.click(header());
      expect(screen.getByTestId("score-view")).not.toBeVisible();
      unmount();
    }
  });

  it("a collapsed score card shows its airport codes in the header summary", async () => {
    render(<ToolUseBlockView block={{ ...block(SCORE_TWO), input: { airport_codes: ["LAX", "SNA"] } }} />);
    const h = screen.getByRole("button", { name: /score_airports/ });
    await userEvent.click(h);
    expect(h).toHaveAttribute("aria-expanded", "false");
    expect(h).toHaveTextContent("LAX, SNA");
  });

  it("a generic card's summary is still its first string argument", () => {
    render(<ToolUseBlockView block={block({ intent: "in_scope" }, "classify_message")} />);
    expect(screen.getByRole("button", { name: /classify_message/ })).toHaveTextContent("classify_message");
    render(<ToolUseBlockView block={{ ...block({ ok: true }, "other_tool"), input: { query: "hello there" } }} />);
    expect(screen.getByRole("button", { name: /other_tool/ })).toHaveTextContent("hello there");
  });

  it("a generic tool card is unchanged: closed by default, toggles its JSON", async () => {
    render(<ToolUseBlockView block={block({ intent: "in_scope" }, "classify_message")} />);
    const h = screen.getByRole("button", { name: /classify_message/ });
    expect(h).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("score-view")).toBeNull();
    expect(screen.getByText("Output")).not.toBeVisible();
    await userEvent.click(h);
    expect(h).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Output")).toBeVisible();
  });
});

describe("score_airports: 2 airports side by side", () => {
  it("uses #39's compare grid, categories as rows lined up across both columns, and lists notFound", () => {
    const r = checked(SCORE_TWO);
    render(<ToolUseBlockView block={block(SCORE_TWO)} />);
    const grid = screen.getByRole("group", { name: "Comparison: JFK · John F Kennedy International vs LAX · Los Angeles International" });
    const heads = [...grid.querySelectorAll(".viz-compare__head")].map((h) => h.textContent);
    expect(heads).toEqual(["JFK · John F Kennedy International", "LAX · Los Angeles International"]);
    const labels = [...grid.querySelectorAll(".viz-compare__label")].map((l) => l.textContent);
    expect(labels).toEqual(["Final score", ...CATEGORIES.map((k) => r.ranking[0]?.breakdown[k].label)]);
    labels.forEach((label, row) => {
      const a = within(grid).getByRole("group", { name: `${label}, ${heads[0]}` });
      const b = within(grid).getByRole("group", { name: `${label}, ${heads[1]}` });
      expect(a.dataset.row).toBe(String(3 + 2 * row));
      expect(b.dataset.row).toBe(a.dataset.row);
      expect([a.dataset.col, b.dataset.col]).toEqual(["1", "2"]);
    });
    r.ranking.forEach((airport, col) => {
      const cell = within(grid).getByRole("group", { name: `Final score, ${heads[col]}` });
      expect(within(cell).getByLabelText(`Final score, ${formatScore(airport.score)}, / 100`)).toBeInTheDocument();
      CATEGORIES.forEach((k) => {
        const c = within(grid).getByRole("group", { name: `${airport.breakdown[k].label}, ${heads[col]}` });
        expect(c.querySelector(".score-cat__value")?.textContent).toBe(String(airport.breakdown[k].subScore));
      });
    });
    expect(screen.getByText("Fixed scales on each airport's own numbers")).toBeInTheDocument(); // #75: the same label for 2+ airports
    expect(screen.getByText("Not found: ZZZ")).toBeInTheDocument();
  });
});

describe("score_airports: 3-5 airports are a table by final score", () => {
  it.each([
    ["3", SCORE_THREE],
    ["5", SCORE_FIVE],
  ])("%s airports: sorted by final score, highest first, even when the tool's order is not", (_n, fixture) => {
    const r = checked(fixture);
    const shuffled = clone(fixture) as { ranking: JsonValue[] };
    shuffled.ranking.reverse();
    render(<ToolUseBlockView block={block(shuffled as JsonValue)} />);
    const expected = [...r.ranking].sort((a, b) => b.score - a.score);
    expect(rowCodes()).toEqual(expected.map((a) => a.airportCode));
    const rows = screen.getAllByTestId("score-row");
    rows.forEach((row, i) => {
      const a = expected[i] as RankedAirport;
      const cells = [...row.querySelectorAll("td")].map((td) => td.querySelector(".score-cell__value")?.textContent ?? td.textContent);
      const subs = CATEGORIES.map((k) => {
        const s = a.breakdown[k].subScore;
        return s === null ? "—" : String(s);
      });
      expect(cells).toEqual([String(i + 1), `▸${a.airportCode}`, a.name, String(a.score), formatShare(a.coverage), ...subs]);
    });
    const heads = within(screen.getByRole("table", { name: "Airports by final score" })).getAllByRole("columnheader");
    expect(heads.map((h) => h.textContent).slice(0, 5)).toEqual(["Rank", "Code", "Name", "Final score", "Coverage"]);
    expect(heads).toHaveLength(9);
  });

  it("opens a row to show that airport's evidence", async () => {
    render(<ToolUseBlockView block={block(SCORE_FIVE)} />);
    const toggle = screen.getByRole("button", { name: "SNA evidence" });
    const detail = document.getElementById(toggle.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(detail).not.toBeVisible();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(detail).toBeVisible();
    expect(within(detail).getAllByTestId("score-category")).toHaveLength(4);
    expect(within(detail).getByText("No growth data available for this airport.")).toBeInTheDocument();
    expect(screen.getByText("Not found: XYZ")).toBeInTheDocument();
  });

  it("6 or more airports: the top 5 and a +N more note", () => {
    const six = clone(SCORE_FIVE) as { ranking: { airportCode: string; score: number }[] };
    six.ranking.push({ ...clone(six.ranking[4]!), airportCode: "LOW", score: 90 });
    six.ranking.push({ ...clone(six.ranking[4]!), airportCode: "LOWER", score: 0.5 });
    render(<ToolUseBlockView block={block(six as unknown as JsonValue)} />);
    const top5 = [...six.ranking].sort((a, b) => b.score - a.score).slice(0, 5).map((a) => a.airportCode);
    expect(rowCodes()).toEqual(top5);
    expect(top5).not.toContain("LOWER");
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("keeps duplicate codes as separate rows and a tie in the tool's order", () => {
    const dup = clone(SCORE_THREE) as { ranking: { airportCode: string; score: number; name: string }[] };
    dup.ranking.forEach((a) => (a.score = 40));
    dup.ranking[2]!.airportCode = "LAX";
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ToolUseBlockView block={block(dup as unknown as JsonValue)} />);
    expect(rowCodes()).toEqual(dup.ranking.map((a) => a.airportCode));
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("score_airports: anything else is the generic JSON view", () => {
  it.each<[string, JsonValue]>([
    ["a bad shape", { ranking: "LAX" }],
    ["a partial result (no breakdown)", { ranking: [{ airportCode: "LAX", name: "x", score: 1, coverage: 1, missing: [] }], notFound: [] }],
    ["0 airports", { ranking: [], notFound: ["ZZZ"] }],
    ["null", null],
    ["a string", "88"],
  ])("%s: no throw, the raw JSON under Output", async (_name, output) => {
    render(<ToolUseBlockView block={block(output)} />);
    await expectGeneric(output);
  });

  it("another tool with a score-shaped output stays generic", () => {
    render(<ToolUseBlockView block={block(SCORE_ONE, "get_enplanements")} />);
    expect(screen.queryByTestId("score-view")).toBeNull();
  });

  it("a running or failed score_airports call stays generic", () => {
    const { rerender } = render(
      <ToolUseBlockView block={{ type: "tool_use", toolCallId: TOOL, name: "score_airports", input: {}, status: "running" }} />,
    );
    expect(screen.getByText("Running")).toBeInTheDocument();
    rerender(
      <ToolUseBlockView
        block={{ type: "tool_use", toolCallId: TOOL, name: "score_airports", input: {}, status: "failed", errorMessage: "none found" }}
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByTestId("score-view")).toBeNull();
  });
});
