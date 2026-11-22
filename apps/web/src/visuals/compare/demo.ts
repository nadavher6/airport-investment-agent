/**
 * Demo ```compare body: LAX vs SNA with real FAA enplanements copied from data/enplanements.json
 * (CY2015-CY2024; FAA ranks; hub types L and M). Used by the tests and the dev-only demo page.
 */
const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

export const COMPARE_FAA = {
  LAX: {
    name: "LAX: Los Angeles Intl",
    hub: "Large hub",
    enplanements: [36351272, 39636042, 41232432, 42624050, 42939104, 14055777, 23663410, 32326616, 40956673, 37760834],
    rank2024: 5,
  },
  SNA: {
    name: "SNA: John Wayne",
    hub: "Medium hub",
    enplanements: [4945209, 5217242, 5082716, 5201642, 5153276, 1824836, 3807205, 5536313, 5706332, 5370273],
    rank2024: 44,
  },
} as const;

type Code = keyof typeof COMPARE_FAA;
const codes: Code[] = ["LAX", "SNA"];
const at = (c: Code, year: number): number => COMPARE_FAA[c].enplanements[years.indexOf(year)] ?? 0;
const pct = (from: number, to: number): string => {
  const p = ((to - from) / from) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
};

const kpi = (c: Code) => ({
  kind: "kpi",
  spec: {
    items: [
      { label: "CY2024", value: at(c, 2024), unit: "passengers", delta: `${pct(at(c, 2019), at(c, 2024))} vs 2019` },
      { label: "FAA rank", value: COMPARE_FAA[c].rank2024 },
    ],
  },
});

const trend = (c: Code) => ({
  kind: "chart",
  spec: {
    type: "line",
    title: `${c} enplanements, CY2015-CY2024`,
    x: "year",
    unit: "passengers",
    series: [{ name: c, points: years.map((y) => [y, at(c, y)]) }],
  },
});

const recovery = (c: Code) => ({
  kind: "table",
  spec: {
    title: `${c}: before and after 2020`,
    columns: ["Year", "Enplanements"],
    rows: [2019, 2020, 2024].map((y) => [String(y), at(c, y)]),
  },
});

const notes: Record<Code, string> = {
  LAX: `**${COMPARE_FAA.LAX.hub}.** Still **${pct(at("LAX", 2019), at("LAX", 2024))}** below its 2019 peak in CY2024.`,
  SNA: `**${COMPARE_FAA.SNA.hub}.** Above its 2019 level since 2022: **${pct(at("SNA", 2019), at("SNA", 2024))}** in CY2024.`,
};

export const COMPARE_DEMO = {
  title: "LAX vs SNA",
  columns: codes.map((c) => COMPARE_FAA[c].name),
  rows: [
    { label: "Traffic", cells: codes.map((c) => [kpi(c)]) },
    { label: "Trend", cells: codes.map((c) => [trend(c)]) },
    { label: "Recovery", cells: codes.map((c) => [recovery(c)]) },
    { label: "Takeaway", cells: codes.map((c) => [{ kind: "markdown", text: notes[c] }]) },
  ],
};

export const COMPARE_DEMO_BODY = JSON.stringify(COMPARE_DEMO, null, 2);
