import "./visuals.css";
import type { ReactNode } from "react";
import { parseVisual, type FenceLang, type VisualSpec } from "./spec";
import { LineChart } from "./LineChart";
import { BarChart } from "./BarChart";
import { DataTable } from "./DataTable";
import { KpiTiles } from "./KpiTiles";
import { VisualBoundary, VisualFallback } from "./fallback";

function SpecView({ spec }: { spec: VisualSpec }) {
  switch (spec.type) {
    case "line":
      return <LineChart spec={spec} />;
    case "bar":
      return <BarChart spec={spec} />;
    case "table":
      return <DataTable spec={spec} />;
    case "kpi":
      return <KpiTiles spec={spec} />;
  }
}

/** Parses one closed fence body and draws it, or falls back. Parsing happens inside the boundary. */
function FenceVisual({ lang, body }: { lang: FenceLang; body: string }) {
  const result = parseVisual(lang, body);
  if (result.ok) return <SpecView spec={result.spec} />;
  return <VisualFallback body={body} reason={result.reason} json={result.json} />;
}

/** The renderer for one fence language, in the registry's shape. Never throws. */
export function renderVisual(lang: FenceLang): (body: string) => ReactNode {
  return (body: string) => (
    <VisualBoundary body={body}>
      <FenceVisual lang={lang} body={body} />
    </VisualBoundary>
  );
}
