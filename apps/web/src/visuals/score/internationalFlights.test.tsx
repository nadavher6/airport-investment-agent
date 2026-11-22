// #74: the long-haul category shows the number of international flights and passengers (evidence inputs),
// in the score view and the category view (card, compare, table), with "—" for null.
import type { JsonValue, ToolUseBlock } from "@airport/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolUseBlockView } from "../../components/blocks/ToolUseBlockView";
import { TOOL } from "../../test/fixtures";
import { SCORE_ONE } from "./fixtures";
import { formatIntlFlights, formatIntlPassengers, internationalFlights, type Evidence } from "./spec";

const block = (output: JsonValue, name: string, codes: string[]): ToolUseBlock => ({
  type: "tool_use",
  toolCallId: TOOL,
  name,
  input: { airport_codes: codes },
  status: "succeeded",
  output,
});

type Counts = { flights: number | null; departures: number | null; passengers: number | null };
const LAX: Counts = { flights: 61715, departures: 266820, passengers: 11307246 };
const SNA: Counts = { flights: 985, departures: 51447, passengers: 112459 };
const NIP: Counts = { flights: null, departures: 3, passengers: null };

const evidence = (c: Counts): JsonValue => ({
  formula: "international seats ÷ total seats",
  inputs: { internationalShare: 30.8, internationalDepartures: c.flights, departures: c.departures, internationalPassengers: c.passengers },
  value: 30.8,
  explanation: "30.8% of seats were international.",
});

const airport = (code: string, c: Counts): JsonValue => ({
  airportCode: code,
  name: `${code} airport`,
  available: true,
  raw: 30.8,
  subScore: 61.6,
  evidence: evidence(c),
});

const longHaul = (airports: JsonValue[]): JsonValue => ({
  category: "long_haul",
  label: "Long-haul share",
  weight: 0.2,
  mode: "absolute",
  scale: "percent",
  unit: "%",
  note: null,
  airports,
  notFound: [],
});

describe("international flights helpers (#74)", () => {
  it("reads the counts from the evidence inputs; null when the evidence is another category's", () => {
    const ev = evidence(LAX) as unknown as Evidence;
    expect(internationalFlights(ev)).toEqual(LAX);
    expect(formatIntlFlights(internationalFlights(ev)!)).toBe("61,715 of 266,820 departures");
    expect(formatIntlPassengers(internationalFlights(ev)!)).toBe("11,307,246");
    expect(internationalFlights({ formula: "x", inputs: { loadFactor: 80 }, value: 80, explanation: "" })).toBeNull();
    expect(internationalFlights(undefined)).toBeNull();
  });

  it("a null count is '—', never 0", () => {
    const f = internationalFlights(evidence(NIP) as unknown as Evidence)!;
    expect(formatIntlFlights(f)).toBe("—");
    expect(formatIntlPassengers(f)).toBe("—");
  });
});

describe("category view shows the international flights (#74)", () => {
  it("1 airport (card): 'International flights: N of M departures' and the passengers", () => {
    render(<ToolUseBlockView block={block(longHaul([airport("LAX", LAX)]), "get_long_haul_share", ["LAX"])} />);
    const card = screen.getByRole("article", { name: "Long-haul share: LAX" });
    expect(within(card).getByTestId("intl-flights")).toHaveTextContent("International flights: 61,715 of 266,820 departures");
    expect(within(card).getByTestId("intl-passengers-value")).toHaveTextContent("11,307,246");
  });

  it("2 airports (compare grid): an International flights row, '—' for a null", () => {
    render(<ToolUseBlockView block={block(longHaul([airport("LAX", LAX), airport("NIP", NIP)]), "get_long_haul_share", ["LAX", "NIP"])} />);
    const grid = screen.getByRole("group", { name: "Comparison: Long-haul share" });
    expect([...grid.querySelectorAll(".viz-compare__label")].map((l) => l.textContent)).toEqual([
      "Raw value",
      "Sub-score",
      "International flights",
      "Evidence",
    ]);
    expect(within(grid).getAllByTestId("intl-flights-cell").map((c) => c.textContent)).toEqual(["61,715 of 266,820 departures", "—"]);
  });

  it("3 airports (table): an Int'l flights column with the counts and '—' for null", () => {
    render(
      <ToolUseBlockView
        block={block(longHaul([airport("LAX", LAX), airport("SNA", SNA), airport("NIP", NIP)]), "get_long_haul_share", ["LAX", "SNA", "NIP"])}
      />,
    );
    const table = screen.getByRole("table", { name: "Airports by Long-haul share sub-score" });
    expect(within(table).getByRole("columnheader", { name: "Int'l flights" })).toBeInTheDocument();
    expect(within(table).getAllByTestId("intl-flights-cell").map((c) => c.textContent)).toEqual([
      "61,715 of 266,820 departures",
      "985 of 51,447 departures",
      "—",
    ]);
  });

  it("other categories get no International flights line or column", () => {
    const congestion = { ...(longHaul([airport("LAX", LAX), airport("SNA", SNA), airport("NIP", NIP)]) as Record<string, JsonValue>), category: "congestion", label: "Congestion" };
    // Same airports, but the category is not long-haul: no column.
    render(<ToolUseBlockView block={block(congestion, "get_congestion", ["LAX", "SNA", "NIP"])} />);
    expect(screen.queryByRole("columnheader", { name: "Int'l flights" })).toBeNull();
    expect(screen.queryAllByTestId("intl-flights-cell")).toHaveLength(0);
  });
});

describe("score view shows the international flights (#74)", () => {
  it("the long-haul category of a scored airport shows the counts, and '—' when null", () => {
    const withCounts = JSON.parse(JSON.stringify(SCORE_ONE)) as { ranking: Array<{ breakdown: { long_haul: { evidence: { inputs: Record<string, number | null> } } } }> };
    Object.assign(withCounts.ranking[0]!.breakdown.long_haul.evidence.inputs, {
      internationalDepartures: 61715,
      departures: 266820,
      internationalPassengers: 11307246,
    });
    const { unmount } = render(<ToolUseBlockView block={block(withCounts as unknown as JsonValue, "score_airports", ["LAX"])} />);
    expect(screen.getByTestId("intl-flights")).toHaveTextContent("International flights: 61,715 of 266,820 departures");
    expect(screen.getByTestId("intl-passengers-value")).toHaveTextContent("11,307,246");
    unmount();

    Object.assign(withCounts.ranking[0]!.breakdown.long_haul.evidence.inputs, {
      internationalDepartures: null,
      internationalPassengers: null,
    });
    render(<ToolUseBlockView block={block(withCounts as unknown as JsonValue, "score_airports", ["LAX"])} />);
    expect(screen.getByTestId("intl-flights-value")).toHaveTextContent("—");
    expect(screen.getByTestId("intl-passengers-value")).toHaveTextContent("—");
  });

  it("an older output without the inputs shows no line", () => {
    render(<ToolUseBlockView block={block(SCORE_ONE, "score_airports", ["LAX"])} />);
    expect(screen.queryByTestId("intl-flights")).toBeNull();
  });
});
