import type { JsonValue, ToolUseBlock } from "@airport/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolUseBlockView } from "../../components/blocks/ToolUseBlockView";
import { TOOL } from "../../test/fixtures";
import { growthAirports, parseCategoryResult, type CategoryResult } from "./categorySpec";
import { GROWTH_ONE, GROWTH_THREE } from "./growthFixtures";
import { growthChartSpec } from "./GrowthView";

const block = (output: JsonValue, codes: string[]): ToolUseBlock => ({
  type: "tool_use",
  toolCallId: TOOL,
  name: "get_growth",
  input: { airport_codes: codes },
  status: "succeeded",
  output,
});
const checked = (f: JsonValue): CategoryResult => {
  const r = parseCategoryResult(f);
  if (!r.ok) throw new Error(r.reason);
  return r.result;
};
const YEARS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

describe("growth view (#67)", () => {
  it("the real get_growth outputs pass the check; the chart spec has one series per airport, 10 years in order", () => {
    const one = growthAirports(checked(GROWTH_ONE))!;
    const three = growthAirports(checked(GROWTH_THREE))!;
    expect(growthChartSpec(one).series).toHaveLength(1);
    const spec = growthChartSpec(three);
    expect(spec.series.map((s) => s.name)).toEqual(["LAX", "DEN", "0AK"]);
    for (const s of spec.series) expect(s.points.map((p) => p[0])).toEqual(YEARS);
    expect(spec.series[0]!.points[0]).toEqual([2015, 36_351_272]);
    // 0AK's missing years stay null (a gap), never zero.
    expect(spec.series[2]!.points.filter((p) => p[1] === null).map((p) => p[0])).toEqual([2020, 2021]);
  });

  it("1 airport: a line chart with one line, the 2019 / 2020 annotations and the KPI row; no legend", () => {
    const { container } = render(<ToolUseBlockView block={block(GROWTH_ONE, ["LAX"])} />);
    const view = screen.getByTestId("growth-view");
    expect(container.querySelectorAll("path.viz-line")).toHaveLength(1);
    const d = container.querySelector("path.viz-line")!.getAttribute("d")!;
    expect(d.match(/[ML]/g)).toHaveLength(10);
    expect(within(view).getByText("2019 pre-COVID baseline")).toBeInTheDocument();
    expect(within(view).getByText("2020 COVID low")).toBeInTheDocument();
    expect(screen.getAllByTestId("line-marker")).toHaveLength(2);
    expect(container.querySelector(".viz-legend")).toBeNull();
    const kpis = screen.getAllByTestId("growth-kpis");
    expect(kpis).toHaveLength(1);
    expect(within(kpis[0]!).getByText("5-yr CAGR (2019–2024)")).toBeInTheDocument();
    expect(within(kpis[0]!).getByText("-2.5%")).toBeInTheDocument();
    expect(within(kpis[0]!).getByText("88%")).toBeInTheDocument();
    expect(within(kpis[0]!).getByText("Latest (CY2024)")).toBeInTheDocument();
    expect(within(kpis[0]!).getByText("37.8M")).toBeInTheDocument();
  });

  it("3 airports: three series with a legend, and 0AK's missing years are a gap (two runs), not zeros", () => {
    const { container } = render(<ToolUseBlockView block={block(GROWTH_THREE, ["LAX", "DEN", "0AK"])} />);
    const paths = [...container.querySelectorAll("path.viz-line")].map((p) => p.getAttribute("d")!);
    expect(paths).toHaveLength(3);
    expect(paths[0]!.match(/M/g)).toHaveLength(1);
    // 0AK: 2015-2019 then 2022-2024 -> two "M" runs, 8 points; no point drawn for 2020 / 2021.
    expect(paths[2]!.match(/M/g)).toHaveLength(2);
    expect(paths[2]!.match(/[ML]/g)).toHaveLength(8);
    for (const code of ["LAX", "DEN", "0AK"]) expect(within(container.querySelector(".viz-legend") as HTMLElement).getByText(code)).toBeInTheDocument();
    expect(screen.getAllByTestId("growth-kpis")).toHaveLength(3);
    // The screen-reader summary names the gap.
    expect(container.querySelector("svg[aria-label]")!.getAttribute("aria-label")).toMatch(/0AK .*no data for 2020, 2021/);
  });

  it("bad shape: a malformed growth series falls back to the generic card", () => {
    const bad = JSON.parse(JSON.stringify(GROWTH_ONE)) as { airports: Array<{ growth: { series: unknown } }> };
    bad.airports[0]!.growth.series = "nope";
    render(<ToolUseBlockView block={block(bad as unknown as JsonValue, ["LAX"])} />);
    expect(screen.queryByTestId("growth-view")).toBeNull();
    expect(screen.queryByTestId("category-view")).toBeNull();
  });
});
