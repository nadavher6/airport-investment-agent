import type { JsonValue, ToolUseBlock } from "@airport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolUseBlockView } from "../../components/blocks/ToolUseBlockView";
import { TOOL } from "../../test/fixtures";
import { CATEGORY_FOUR, CATEGORY_ONE, CATEGORY_TWO } from "./categoryFixtures";
import { CATEGORY_TOOLS, isCategoryTool, parseCategoryResult, sortBySubScore, type CategoryResult } from "./categorySpec";

// The real ToolUseBlockView, as the chat draws a tool_use block; nothing is mocked.
const block = (output: JsonValue, name = "get_congestion", codes: string[] = ["LAX"]): ToolUseBlock => ({
  type: "tool_use",
  toolCallId: TOOL,
  name,
  input: { airport_codes: codes },
  status: "succeeded",
  output,
});
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const checked = (f: JsonValue): CategoryResult => {
  const r = parseCategoryResult(f);
  if (!r.ok) throw new Error(r.reason);
  return r.result;
};

/** The generic card: no category view, the raw JSON under "Output" after opening the header. */
async function expectGeneric(output: JsonValue, name = "get_congestion") {
  expect(screen.queryByTestId("category-view")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
  expect(screen.getByText("Output")).toBeVisible();
  expect(screen.getByText((_t, el) => el?.tagName === "PRE" && el.textContent === JSON.stringify(output, null, 2))).toBeVisible();
}

describe("category spec (#61)", () => {
  it("accepts the real tool outputs and names the four tools", () => {
    for (const f of [CATEGORY_ONE, CATEGORY_TWO, CATEGORY_FOUR]) expect(parseCategoryResult(f).ok).toBe(true);
    expect(CATEGORY_TOOLS.every(isCategoryTool)).toBe(true);
    expect(isCategoryTool("score_airports")).toBe(false);
  });

  it("sorts by sub-score, missing last, without changing the input", () => {
    const r = checked(CATEGORY_FOUR);
    expect(sortBySubScore(r.airports).map((a) => a.airportCode)).toEqual(["ATL", "LAX", "SNA", "2A3"]);
    expect(r.airports.map((a) => a.airportCode)).toEqual(["SNA", "2A3", "LAX", "ATL"]);
  });
});

describe("category view: 1 airport is a card", () => {
  it("shows only that category: raw value, sub-score tile and bar, explanation and formula", () => {
    const lax = checked(CATEGORY_ONE).airports[0]!;
    render(<ToolUseBlockView block={block(CATEGORY_ONE, "get_unmet_demand")} />);
    const card = screen.getByRole("article", { name: "Unmet demand (load factor): LAX" });
    expect(screen.getByText(/Unmet demand \(load factor\) · 30% of the final score · Fixed scales on each airport's own numbers/)).toBeInTheDocument();
    expect(within(card).getByLabelText("Raw value, 81.9%")).toHaveClass("viz-kpi__tile");
    expect(within(card).getByLabelText("Sub-score, 81.9, / 100")).toHaveClass("viz-kpi__tile");
    expect(within(card).getByRole("meter")).toHaveAttribute("aria-valuenow", "81.9");
    expect(within(card).getByText(lax.evidence!.explanation)).toBeInTheDocument();
    expect(within(card).getByText(lax.evidence!.formula)).toHaveClass("score-cat__formula");
    expect(screen.getByText(/^Caveat: Load factor/)).toBeInTheDocument();
    // Only the one category: no final score, coverage or other categories.
    expect(screen.queryByText(/Final score|Coverage|Congestion|Long-haul|Growth/)).toBeNull();
  });

  it("a missing airport says what is needed, with no bar", () => {
    const missing = clone(CATEGORY_FOUR);
    missing.airports = missing.airports.filter((a) => a.airportCode === "2A3");
    render(<ToolUseBlockView block={block(missing)} />);
    const card = screen.getByRole("article", { name: /: 2A3$/ });
    expect(within(card).getByText(/^Not computed — needs runway utilization/)).toBeInTheDocument();
    expect(within(card).queryByRole("meter")).toBeNull();
    expect(within(card).getByText("No BTS T-100 record for this airport, so its annual operations are unknown and congestion is missing.")).toBeInTheDocument();
  });
});

describe("category view: the raw value carries its unit", () => {
  const withUnit = (category: string, label: string, unit: string, raw: number): JsonValue => {
    const o = structuredClone(CATEGORY_ONE) as Record<string, unknown>;
    o.category = category;
    o.label = label;
    o.unit = unit;
    (o.airports as Array<Record<string, unknown>>)[0]!.raw = raw;
    return o as JsonValue;
  };

  it.each([
    ["get_unmet_demand", "unmet_demand", "Unmet demand (load factor)", "%", 81.9, "81.9%"],
    ["get_long_haul_share", "long_haul", "Long-haul share", "%", 30.8, "30.8%"],
    ["get_growth", "growth", "Growth / durability", "% per year", 6.2, "6.2% per year"],
    ["get_congestion", "congestion", "Congestion: runway utilization", "%", 86.8, "86.8%"],
  ] as const)("%s shows %s raw as %s", (tool, category, label, unit, raw, shown) => {
    render(<ToolUseBlockView block={block(withUnit(category, label, unit, raw), tool)} />);
    expect(screen.getByLabelText(`Raw value, ${shown}`)).toHaveClass("viz-kpi__tile");
  });

  it("an output without a unit still shows the plain number", () => {
    const o = structuredClone(CATEGORY_ONE) as Record<string, unknown>;
    delete o.unit;
    render(<ToolUseBlockView block={block(o as JsonValue, "get_unmet_demand")} />);
    expect(screen.getByLabelText("Raw value, 81.9")).toBeInTheDocument();
  });
});

describe("category view: 2 airports side by side", () => {
  it("uses #39's compare grid with raw value, sub-score and evidence rows", () => {
    render(<ToolUseBlockView block={block(CATEGORY_TWO, "get_congestion", ["LAX", "SNA"])} />);
    const grid = screen.getByRole("group", { name: "Comparison: Congestion: runway utilization" });
    expect([...grid.querySelectorAll(".viz-compare__head")].map((h) => h.textContent)).toEqual([
      "LAX · Los Angeles International",
      "SNA · John Wayne/Orange County",
    ]);
    expect([...grid.querySelectorAll(".viz-compare__label")].map((l) => l.textContent)).toEqual(["Raw value", "Sub-score", "Evidence"]);
    expect(within(grid).getByRole("group", { name: "Raw value, LAX · Los Angeles International" })).toHaveTextContent("72.6%");
    expect(within(grid).getByRole("group", { name: "Raw value, SNA · John Wayne/Orange County" })).toHaveTextContent("47.3%");
    expect(within(grid).getAllByRole("meter").map((m) => m.getAttribute("aria-valuenow"))).toEqual(["72.6", "47.3"]);
  });
});

describe("category view: 3-5 airports are a table", () => {
  it("sorts rows by sub-score (missing last), shows raw values, and lists notFound", () => {
    render(<ToolUseBlockView block={block(CATEGORY_FOUR, "get_congestion", ["SNA", "2A3", "LAX", "ATL", "ZZZ"])} />);
    const rows = screen.getAllByTestId("category-row");
    expect(rows.map((r) => within(r).getByRole("button").textContent?.replace("▸", ""))).toEqual(["ATL", "LAX", "SNA", "2A3"]);
    expect(rows[0]).toHaveTextContent("82.8%");
    expect(within(rows[3]!).getByTitle("Not computed")).toBeInTheDocument();
    expect(screen.getByText("Not found: ZZZ")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Airports by Congestion: runway utilization sub-score" })).toBeInTheDocument();
  });

  it("a row opens its evidence", async () => {
    render(<ToolUseBlockView block={block(CATEGORY_FOUR)} />);
    const toggle = screen.getByRole("button", { name: "SNA evidence" });
    const detail = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(detail).not.toBeVisible();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(detail).getByText(/51,447 T-100 departures/)).toBeVisible();
  });

  it("more than 5 airports shows the top 5 and a +N more note", () => {
    const six = clone(CATEGORY_FOUR);
    six.airports = [...six.airports, ...six.airports.slice(0, 2).map((a) => ({ ...a, airportCode: `${a.airportCode}X` }))];
    render(<ToolUseBlockView block={block(six)} />);
    expect(screen.getAllByTestId("category-row")).toHaveLength(5);
    expect(screen.getByText("+1 more")).toBeInTheDocument();
  });
});

describe("category view: the card collapses like the other tool cards (#58)", () => {
  const header = () => screen.getByRole("button", { name: /^get_congestion/ });

  it("is open by default; the header collapses and expands it, for 1, 2 and 4 airports", async () => {
    for (const output of [CATEGORY_ONE, CATEGORY_TWO, CATEGORY_FOUR]) {
      const { unmount } = render(<ToolUseBlockView block={block(output, "get_congestion", ["LAX", "SNA"])} />);
      expect(header()).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("category-view")).toBeVisible();
      await userEvent.click(header());
      expect(header()).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("category-view")).not.toBeVisible();
      expect(header()).toHaveTextContent("LAX, SNA");
      await userEvent.click(header());
      expect(screen.getByTestId("category-view")).toBeVisible();
      unmount();
    }
  });

  it("keeps the raw JSON behind Show data inside the open card", async () => {
    render(<ToolUseBlockView block={block(CATEGORY_ONE)} />);
    const toggle = screen.getByRole("button", { name: "Show data" });
    expect(screen.getByText(/"category": "unmet_demand"/)).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide data" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/"category": "unmet_demand"/)).toBeVisible();
  });
});

describe("category view: malformed or partial results fall back to the JSON card", () => {
  const broken: Array<[string, (o: Record<string, unknown>) => void]> = [
    ["no airports list", (o) => delete o.airports],
    ["an empty airports list", (o) => (o.airports = [])],
    ["an unknown category", (o) => (o.category = "noise")],
    ["a sub-score above 100", (o) => ((o.airports as Array<Record<string, unknown>>)[0]!.subScore = 140)],
    ["a raw value that is a string", (o) => ((o.airports as Array<Record<string, unknown>>)[0]!.raw = "lots")],
    ["no notFound", (o) => delete o.notFound],
  ];

  it.each(broken)("%s -> generic card, no crash", async (_name, breakIt) => {
    const output = clone(CATEGORY_TWO) as unknown as Record<string, unknown>;
    breakIt(output);
    expect(parseCategoryResult(output).ok).toBe(false);
    render(<ToolUseBlockView block={block(output as JsonValue)} />);
    await expectGeneric(output as JsonValue);
  });

  it("a string or null output -> generic card", async () => {
    render(<ToolUseBlockView block={block("oops")} />);
    await expectGeneric("oops");
  });

  it("a category output under another tool's name is not drawn as a category", () => {
    render(<ToolUseBlockView block={block(CATEGORY_ONE, "get_enplanements")} />);
    expect(screen.queryByTestId("category-view")).toBeNull();
  });

  it("a failed category call is the generic card with its error", async () => {
    const failed: ToolUseBlock = { type: "tool_use", toolCallId: TOOL, name: "get_congestion", input: { airport_codes: ["ZZZ"] }, status: "failed", errorMessage: "None found." };
    render(<ToolUseBlockView block={failed} />);
    expect(screen.queryByTestId("category-view")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /get_congestion/ }));
    expect(screen.getByText("None found.")).toBeVisible();
  });
});

describe("category view: a view that throws", () => {
  it("falls back to the generic JSON card; nothing else breaks", async () => {
    vi.resetModules();
    vi.doMock("./CategoryView", () => ({
      CategoryView: () => {
        throw new Error("boom");
      },
    }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ToolUseBlockView: View } = await import("../../components/blocks/ToolUseBlockView");
    render(
      <div>
        <View block={block(CATEGORY_TWO)} />
        <p>after the card</p>
      </div>,
    );
    expect(screen.getByText("after the card")).toBeInTheDocument();
    expect(screen.queryByTestId("category-view")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /get_congestion/ }));
    expect(screen.getByText(/"category": "congestion"/)).toBeVisible();
    error.mockRestore();
    vi.doUnmock("./CategoryView");
  });
});
