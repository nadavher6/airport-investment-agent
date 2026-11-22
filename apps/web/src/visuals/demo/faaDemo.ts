/**
 * Demo fence bodies for all four visual types, with real FAA enplanement numbers for
 * LAX, ATL and ORD copied from data/enplanements.json (CY2015-CY2024).
 * Used by the tests and by the dev-only page (visuals-demo.html).
 */
import type { FenceLang } from "../spec";

const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

export const FAA = {
  LAX: [36351272, 39636042, 41232432, 42624050, 42939104, 14055777, 23663410, 32326616, 40956673, 37760834],
  ATL: [49340732, 50501858, 50251964, 51865797, 53505795, 20559866, 36676010, 45396001, 50950068, 52511402],
  ORD: [36305668, 37589899, 38593028, 39873927, 40871223, 14606034, 26350976, 33120474, 35843104, 38575693],
} as const;

type Code = keyof typeof FAA;
const codes: Code[] = ["ATL", "LAX", "ORD"];
const at2024 = (c: Code): number => FAA[c][9];
const at2019 = (c: Code): number => FAA[c][4];
/** Change from CY2019 to CY2024, e.g. "-12.1% vs 2019". */
const vs2019 = (c: Code): string => {
  const pct = ((at2024(c) - at2019(c)) / at2019(c)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs 2019`;
};

export const DEMO_FENCES: { lang: FenceLang; title: string; body: string }[] = [
  {
    lang: "chart",
    title: "Line",
    body: JSON.stringify({
      type: "line",
      title: "Enplanements, CY2015-CY2024",
      x: "year",
      unit: "passengers",
      series: codes.map((c) => ({ name: c, points: years.map((y, i) => [y, FAA[c][i]]) })),
    }),
  },
  {
    lang: "chart",
    title: "Bar",
    body: JSON.stringify({
      type: "bar",
      title: "Enplanements, CY2024",
      unit: "passengers",
      sort: "desc",
      items: codes.map((c) => ({ label: c, value: at2024(c) })),
    }),
  },
  {
    lang: "table",
    title: "Table",
    body: JSON.stringify({
      title: "CY2019 vs CY2024",
      columns: ["Airport", "CY2019", "CY2024", "Change"],
      rows: codes.map((c) => [c, at2019(c), at2024(c), vs2019(c)]),
    }),
  },
  {
    lang: "kpi",
    title: "KPI",
    body: JSON.stringify({
      items: codes.map((c) => ({ label: `${c} CY2024`, value: at2024(c), unit: "passengers", delta: vs2019(c) })),
    }),
  },
];
