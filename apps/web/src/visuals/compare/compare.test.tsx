import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "../../components/markdown/Markdown";
import { getFenceRenderer, resetFencesForTests } from "../../components/markdown/fences";
import { registerVisuals } from "../registerVisuals";
import { COMPARE_NOTE } from "./Compare";
import { COMPARE_DEMO, COMPARE_DEMO_BODY } from "./demo";
import { registerCompare } from "./registerCompare";

// The REAL registry and the real Markdown component; nothing is mocked.
beforeEach(() => {
  resetFencesForTests();
  registerVisuals();
  registerCompare();
});

const fence = (body: string, before = "Here is the comparison.", after = "That is all.") =>
  `${before}\n\n\`\`\`compare\n${body}\n\`\`\`\n\n${after}`;

const cell = (row: string, column: string): HTMLElement => screen.getByRole("group", { name: `${row}, ${column}` });

const [LAX, SNA] = COMPARE_DEMO.columns as [string, string];

describe("the compare fence", () => {
  it("is registered as 'compare' through fences.ts", () => {
    expect(getFenceRenderer("compare")).toBeTypeOf("function");
  });

  it("renders both column headers, the row labels, and the text around it", () => {
    const { container } = render(<Markdown text={fence(COMPARE_DEMO_BODY)} />);
    const grid = screen.getByRole("group", { name: "Comparison: LAX vs SNA" });
    const heads = [...grid.querySelectorAll(".viz-compare__head")].map((h) => h.textContent);
    expect(heads).toEqual([LAX, SNA]);
    const labels = [...grid.querySelectorAll(".viz-compare__label")].map((l) => l.textContent);
    expect(labels).toEqual(["Traffic", "Trend", "Recovery", "Takeaway"]);
    // Text before and after stays normal full-width markdown, outside the grid.
    expect(screen.getByText("Here is the comparison.").closest(".viz-compare")).toBeNull();
    expect(screen.getByText("That is all.")).toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
  });

  it("puts each cell's blocks in the right column, cells of a row in the same grid row", () => {
    render(<Markdown text={fence(COMPARE_DEMO_BODY)} />);
    COMPARE_DEMO.rows.forEach((row, r) => {
      const a = cell(row.label, LAX);
      const b = cell(row.label, SNA);
      expect(a.dataset.row).toBe(String(3 + 2 * r));
      expect(b.dataset.row).toBe(a.dataset.row);
      expect(a.style.getPropertyValue("--cmp-row")).toBe(b.style.getPropertyValue("--cmp-row"));
      expect([a.dataset.col, b.dataset.col]).toEqual(["1", "2"]);
      expect(a.style.getPropertyValue("--cmp-col")).toBe("1");
      expect(b.style.getPropertyValue("--cmp-col")).toBe("2");
    });
    // Mixed blocks, each drawn by #33's components (kpi, line chart, table) or Markdown.
    expect(within(cell("Traffic", LAX)).getByLabelText(/CY2024/)).toHaveClass("viz-kpi__tile");
    expect(within(cell("Trend", LAX)).getByRole("img", { name: /LAX enplanements/ })).toBeInTheDocument();
    expect(within(cell("Trend", SNA)).getByRole("img", { name: /SNA enplanements/ })).toBeInTheDocument();
    expect(within(cell("Recovery", SNA)).getByRole("table", { name: /SNA: before and after 2020/ })).toBeInTheDocument();
    const note = within(cell("Takeaway", SNA)).getByText("Medium hub.");
    expect(note.tagName).toBe("STRONG");
    expect(cell("Takeaway", LAX)).not.toHaveTextContent("Medium hub");
  });

  it("orders the stacked view as all of column A, then all of column B", () => {
    const { container } = render(<Markdown text={fence(COMPARE_DEMO_BODY)} />);
    const items = [...container.querySelectorAll<HTMLElement>(".viz-compare__head, .viz-compare__cell")];
    const stacked = items
      .sort((x, y) => Number(x.style.getPropertyValue("--cmp-order")) - Number(y.style.getPropertyValue("--cmp-order")))
      .map((el) => el.getAttribute("aria-label") ?? el.textContent);
    const rows = COMPARE_DEMO.rows.map((r) => r.label);
    expect(stacked).toEqual([LAX, ...rows.map((r) => `${r}, ${LAX}`), SNA, ...rows.map((r) => `${r}, ${SNA}`)]);
    // Each cell carries its own copy of the row label for the stacked view (hidden from screen readers).
    const copy = cell("Trend", SNA).querySelector(".viz-compare__cell-label");
    expect(copy).toHaveTextContent("Trend");
    expect(copy).toHaveAttribute("aria-hidden", "true");
  });

  it("one bad chart block falls back alone; its neighbours, the other cells and the message still render", () => {
    const spec = structuredClone(COMPARE_DEMO) as { rows: { label: string; cells: unknown[][] }[] };
    const trend = spec.rows[1]!;
    trend.cells[0] = [{ kind: "chart", spec: { type: "line", series: [{ name: "LAX", points: [[2024, "lots"]] }] } }, { kind: "markdown", text: "Still here." }];
    render(<Markdown text={fence(JSON.stringify(spec))} />);
    const bad = cell("Trend", LAX);
    expect(within(bad).getByText(/Could not draw this chart: series\.0\.points\.0\.1/)).toBeInTheDocument();
    expect(within(bad).getByText("Still here.")).toBeInTheDocument();
    expect(within(cell("Trend", SNA)).getByRole("img", { name: /SNA enplanements/ })).toBeInTheDocument();
    expect(within(cell("Traffic", LAX)).getAllByLabelText(/CY2024/).length).toBeGreaterThan(0);
    expect(screen.getByText("That is all.")).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(COMPARE_NOTE))).toBeNull();
  });

  it("a block that throws while rendering falls back alone (error boundary per block)", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const visual = await import("../Visual");
    const real = visual.SpecView;
    // The kpi component is the one that throws; every other block draws normally.
    vi.spyOn(visual, "SpecView").mockImplementation((props) => {
      if (props.spec.type === "kpi") throw new Error("boom");
      return real(props);
    });
    render(<Markdown text={fence(COMPARE_DEMO_BODY)} />);
    expect(within(cell("Traffic", LAX)).getByText(/Could not draw this chart: it failed to render/)).toBeInTheDocument();
    expect(within(cell("Trend", LAX)).getByRole("img")).toBeInTheDocument();
    expect(screen.getByText("That is all.")).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
  });

  it.each([
    ["bad JSON", '{ "columns": ["A", "B"], "rows": [', /Could not draw this comparison: the spec is not valid JSON/],
    ["3 columns", JSON.stringify({ columns: ["A", "B", "C"], rows: [{ label: "R", cells: [[], [], []] }] }), /Could not draw this comparison: columns/],
  ])("%s: a code block with the body plus the note; the message still renders", (_name, body, note) => {
    const { container } = render(<Markdown text={fence(body)} />);
    expect(container.querySelector("pre code")?.textContent).toBe(body);
    expect(screen.getByText(note)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Comparison/ })).toBeNull();
    expect(screen.getByText("Here is the comparison.")).toBeInTheDocument();
    expect(screen.getByText("That is all.")).toBeInTheDocument();
  });

  it("shows the drawing placeholder while the fence is still open", () => {
    render(<Markdown text={`Intro\n\n\`\`\`compare\n${COMPARE_DEMO_BODY}`} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Drawing compare/);
    expect(screen.queryByRole("group", { name: /Comparison/ })).toBeNull();
  });

  it("labels for screen readers: the comparison, each column-row pair, and text headers (not colour)", () => {
    render(<Markdown text={fence(COMPARE_DEMO_BODY)} />);
    const groups = screen.getAllByRole("group").map((g) => g.getAttribute("aria-label"));
    expect(groups).toContain("Comparison: LAX vs SNA");
    for (const row of COMPARE_DEMO.rows) {
      expect(groups).toContain(`${row.label}, ${LAX}`);
      expect(groups).toContain(`${row.label}, ${SNA}`);
    }
  });

  it("uses an untitled name from the columns", () => {
    const { title: _t, ...untitled } = COMPARE_DEMO;
    render(<Markdown text={fence(JSON.stringify(untitled))} />);
    expect(screen.getByRole("group", { name: `Comparison: ${LAX} vs ${SNA}` })).toBeInTheDocument();
  });
});

describe("compare.css", () => {
  // vitest runs in apps/web; css: false empties ?raw imports, so read the file itself.
  const css = readFileSync(resolve(process.cwd(), "src/visuals/compare/compare.css"), "utf8");
  const rule = (selector: string, from = css): string => {
    const start = from.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`no rule ${selector}`);
    return from.slice(start, from.indexOf("}", start));
  };

  it("has no borders on the grid, and flattens the #33 cards inside it", () => {
    expect(rule(".viz-compare__grid")).toMatch(/border: 0;/);
    expect(rule(".viz-compare .viz")).toMatch(/border: 0;/);
    expect(css).not.toMatch(/border(-[a-z]+)?: *[1-9]/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it.each(["@media (max-width: 719px)", "@container (max-width: 559px)"])(
    "is two equal columns when wide, and stacks under %s",
    (query) => {
      expect(rule(".viz-compare")).toMatch(/container-type: inline-size/);
      expect(rule(".viz-compare__grid")).toMatch(/repeat\(var\(--cmp-cols, 2\), minmax\(0, 1fr\)\)/);
      const at = css.indexOf(query);
      expect(at).toBeGreaterThan(0);
      const narrow = css.slice(at);
      expect(rule(".viz-compare__grid", narrow)).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
      expect(rule(".viz-compare__grid > *", narrow)).toMatch(/order: var\(--cmp-order\)/);
      expect(rule(".viz-compare__label", narrow)).toMatch(/display: none/);
      expect(rule(".viz-compare__cell-label", narrow)).toMatch(/display: block/);
    },
  );
});
