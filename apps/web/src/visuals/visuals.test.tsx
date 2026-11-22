import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderVisual } from "./Visual";
import { VisualBoundary, coerceToTable, NOTE } from "./fallback";
import { registerVisuals } from "./registerVisuals";
import { getFenceRenderer, registerFence, type FenceRenderer } from "./fenceRegistryStub";
import { DEMO_FENCES, FAA } from "./demo/faaDemo";
import { deltaDirection } from "./KpiTiles";

const fence = (lang: "chart" | "table" | "kpi", body: unknown): ReturnType<typeof render> =>
  render(<>{renderVisual(lang)(typeof body === "string" ? body : JSON.stringify(body))}</>);

const demo = (title: string): { lang: "chart" | "table" | "kpi"; body: string } => {
  const f = DEMO_FENCES.find((d) => d.title === title);
  if (!f) throw new Error(title);
  return f;
};

describe("LineChart", () => {
  it("renders title, axis labels, legend and end values from the FAA fixture", () => {
    const f = demo("Line");
    const { container } = fence(f.lang, f.body);
    expect(screen.getByText("Enplanements, CY2015-CY2024")).toBeInTheDocument();
    expect(screen.getByText("in passengers")).toBeInTheDocument();
    const svg = container.querySelector("svg") as SVGSVGElement;
    const ticks = [...svg.querySelectorAll(".viz-tick")].map((t) => t.textContent);
    expect(ticks).toEqual(expect.arrayContaining(["0", "60M", "2015", "2024"]));
    expect(svg.querySelector(".viz-axis-title")).toHaveTextContent("year");
    const legend = container.querySelector(".viz-legend") as HTMLElement;
    expect(within(legend).getByText("ATL")).toBeInTheDocument();
    expect(within(legend).getByText("LAX")).toBeInTheDocument();
    expect(within(legend).getByText("ORD")).toBeInTheDocument();
    expect(svg.querySelectorAll(".viz-line")).toHaveLength(3);
    // LAX and ORD end within a few pixels of each other, so end labels give way to the legend.
    expect(svg.querySelectorAll(".viz-label")).toHaveLength(0);
  });

  it("labels the end value directly for a single series, without a legend", () => {
    const { container } = fence("chart", {
      type: "line",
      title: "LAX",
      series: [{ name: "LAX", points: [[2015, FAA.LAX[0]], [2024, FAA.LAX[9]]] }],
    });
    expect(container.querySelector(".viz-legend")).toBeNull();
    expect(container.querySelector(".viz-label")).toHaveTextContent("37.8M");
  });

  it("shows the values at an x on keyboard focus and moves with the arrow keys", () => {
    const f = demo("Line");
    fence(f.lang, f.body);
    const plot = screen.getByLabelText(/use the arrow keys/);
    fireEvent.focus(plot);
    const tip = screen.getByRole("status");
    expect(tip).toHaveTextContent("2024");
    expect(tip).toHaveTextContent("52,511,402 passengers");
    fireEvent.keyDown(plot, { key: "ArrowLeft" });
    expect(screen.getByRole("status")).toHaveTextContent("2023");
    expect(screen.getByRole("status")).toHaveTextContent("40,956,673 passengers");
  });

  it("supports text x values in first-seen order", () => {
    const { container } = fence("chart", {
      type: "line",
      series: [{ name: "A", points: [["Q1", 1], ["Q2", 3], ["Q3", 2]] }],
    });
    const ticks = [...container.querySelectorAll(".viz-tick")].map((t) => t.textContent);
    expect(ticks).toEqual(expect.arrayContaining(["Q1", "Q2", "Q3"]));
  });
});

describe("BarChart", () => {
  it("renders title, sorted categories and values from the FAA fixture", () => {
    const f = demo("Bar");
    const { container } = fence(f.lang, f.body);
    expect(screen.getByText("Enplanements, CY2024")).toBeInTheDocument();
    const cats = [...container.querySelectorAll(".viz-category")].map((t) => t.textContent);
    expect(cats).toEqual(["ATLATL", "ORDORD", "LAXLAX"]); // <title> + visible text
    const values = [...container.querySelectorAll(".viz-label")].map((t) => t.textContent);
    expect(values).toEqual(["52.5M", "38.6M", "37.8M"]);
    expect(container.querySelectorAll(".viz-bar path")).toHaveLength(3);
  });

  it("shows the full value on hover", () => {
    const f = demo("Bar");
    const { container } = fence(f.lang, f.body);
    const first = container.querySelector(".viz-bar") as SVGGElement;
    fireEvent.mouseEnter(first);
    expect(first.querySelector(".viz-label")).toHaveTextContent("52,511,402 passengers");
  });

  it("draws negative values left of the baseline", () => {
    const { container } = fence("chart", { type: "bar", items: [{ label: "A", value: -5 }, { label: "B", value: 10 }] });
    expect(container.querySelectorAll(".viz-label")[0]).toHaveAttribute("text-anchor", "end");
  });
});

describe("DataTable", () => {
  it("renders title, header and formatted cells from the FAA fixture", () => {
    const f = demo("Table");
    fence(f.lang, f.body);
    expect(screen.getByText("CY2019 vs CY2024")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Airport", "CY2019", "CY2024", "Change"]);
    expect(within(table).getByText("37,760,834")).toHaveClass("viz-num");
    expect(within(table).getByText("-12.1% vs 2019")).toBeInTheDocument();
  });
});

describe("KpiTiles", () => {
  it("renders labels, compact values, units and deltas from the FAA fixture", () => {
    const f = demo("KPI");
    fence(f.lang, f.body);
    const tile = screen.getByLabelText(/^LAX CY2024/);
    expect(tile).toHaveTextContent("LAX CY2024");
    expect(tile).toHaveTextContent("37.8M passengers");
    expect(tile).toHaveTextContent("▼ -12.1% vs 2019");
    expect(tile).toHaveAccessibleName("LAX CY2024, 37,760,834, passengers, -12.1% vs 2019");
    expect(screen.getByLabelText(/^ATL CY2024/)).toHaveTextContent("52.5M passengers▼ -1.9% vs 2019");
  });

  it("reads the delta direction from its sign", () => {
    expect(deltaDirection("-2.5% 5y CAGR")).toBe("down");
    expect(deltaDirection("+4%")).toBe("up");
    expect(deltaDirection("flat")).toBe("flat");
  });
});

describe("accessibility", () => {
  it.each(["Line", "Bar"])("%s chart has role img, a summary label and a hidden data table", (title) => {
    const f = demo(title);
    const { container } = fence(f.lang, f.body);
    const img = screen.getByRole("img");
    expect(img.tagName.toLowerCase()).toBe("svg");
    expect(img.getAttribute("aria-label")).toMatch(/chart of 3 (series|items)/);
    expect(img.getAttribute("aria-label")).toMatch(title === "Line" ? /ATL from 49.3M to 52.5M/ : /highest ATL at 52.5M/);
    const hidden = container.querySelector('[data-testid="viz-sr-table"]') as HTMLTableElement;
    expect(hidden).toHaveClass("viz-sr-only");
    expect(within(hidden).getByText("52,511,402")).toBeInTheDocument();
    expect(within(hidden).getByText("ATL")).toBeInTheDocument();
  });
});

describe("fallback", () => {
  it("bad JSON -> a code block plus the note, no throw", () => {
    const body = '{"type":"line", "series": [';
    const { container } = fence("chart", body);
    expect(container.querySelector("pre code")).toHaveTextContent(body);
    expect(screen.getByText(`${NOTE}: the spec is not valid JSON.`)).toBeInTheDocument();
  });

  it("a coercible bad spec -> a table plus the note, no throw", () => {
    fence("chart", { type: "pie", title: "Share", items: [{ label: "ATL", value: 52511402 }, { label: "LAX", value: 37760834 }] });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["label", "value"]);
    expect(within(table).getByText("52,511,402")).toBeInTheDocument();
    expect(screen.getByText(/Could not draw this chart: a chart needs/)).toBeInTheDocument();
  });

  it("coerces line series, ragged tables and arrays; gives up on scalars", () => {
    expect(coerceToTable({ type: "line", series: [{ name: "LAX", points: [[2015, 1], [2016, "x"]] }] })).toEqual({
      columns: ["x", "LAX"],
      rows: [[2015, 1], [2016, "x"]],
    });
    expect(coerceToTable({ columns: ["a", "b"], rows: [[1], [1, 2, 3]] })?.rows).toEqual([[1, null], [1, 2]]);
    expect(coerceToTable([["a", "b"], [1, 2]])).toEqual({ columns: ["a", "b"], rows: [[1, 2]] });
    expect(coerceToTable(42)).toBeNull();
    expect(coerceToTable({ nothing: true })).toBeNull();
  });

  it("a valid-JSON spec with nothing table-like -> the code block plus the note", () => {
    const { container } = fence("kpi", { items: "nope" });
    expect(container.querySelector("pre code")).toBeInTheDocument();
    expect(screen.getByText(/Could not draw this chart: items/)).toBeInTheDocument();
  });

  it("never throws on hostile bodies", () => {
    for (const body of ["", "null", "[]", '"str"', "1e999", '{"type":"line","series":[{"name":"A","points":[[1,1e999]]}]}']) {
      for (const lang of ["chart", "table", "kpi"] as const) {
        expect(() => fence(lang, body)).not.toThrow();
        expect(screen.getAllByText(/Could not draw this chart/).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("VisualBoundary", () => {
  it("shows the code block and the note when a visual throws, and keeps siblings rendering", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const Boom = (): ReactNode => {
      throw new Error("boom");
    };
    const { container } = render(
      <div>
        <p>before</p>
        <VisualBoundary body='{"type":"bar"}'>
          <Boom />
        </VisualBoundary>
      </div>,
    );
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(container.querySelector("pre code")).toHaveTextContent('{"type":"bar"}');
    expect(screen.getByText(`${NOTE}: it failed to render.`)).toBeInTheDocument();
  });
});

describe("registration", () => {
  it("registers chart, table and kpi through the registry interface", () => {
    const seen = new Map<string, FenceRenderer>();
    registerVisuals((lang, render) => seen.set(lang, render));
    expect([...seen.keys()]).toEqual(["chart", "table", "kpi"]);
  });

  it("uses the stub registry by default, and the registered renderer draws the fence", () => {
    registerFence("chart", () => "placeholder");
    registerVisuals();
    for (const lang of ["chart", "table", "kpi"]) expect(getFenceRenderer(lang)).toBeTypeOf("function");
    const f = demo("Bar");
    const render_ = getFenceRenderer("chart") as FenceRenderer;
    render(<>{render_(f.body)}</>);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(getFenceRenderer("python")).toBeUndefined();
  });
});
