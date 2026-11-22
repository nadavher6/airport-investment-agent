import { DEMO_FENCES } from "./faaDemo";
import { renderVisual } from "../Visual";
import { renderCompare } from "../compare/Compare";
import { COMPARE_DEMO_BODY } from "../compare/demo";

/** Dev-only: every visual type, plus the two fallbacks. Not part of the app bundle. */
export function DemoPage() {
  const broken = [
    { lang: "chart" as const, title: "Fallback: bad JSON", body: '{"type":"line", "series": [' },
    {
      lang: "chart" as const,
      title: "Fallback: bad spec, coerced to a table",
      body: JSON.stringify({ type: "pie", title: "Share, CY2024", items: [{ label: "ATL", value: 52511402 }, { label: "LAX", value: 37760834 }] }),
    },
  ];
  return (
    <main style={{ maxWidth: "var(--column)", margin: "0 auto", padding: "var(--space-5)" }}>
      {[...DEMO_FENCES, ...broken].map((f) => (
        <section key={f.title}>
          <h2 style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)", fontWeight: 500 }}>{f.title}</h2>
          {renderVisual(f.lang)(f.body)}
        </section>
      ))}
      <section>
        <h2 style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)", fontWeight: 500 }}>Compare (#39): LAX vs SNA</h2>
        {renderCompare(COMPARE_DEMO_BODY)}
      </section>
      <section style={{ maxWidth: 420 }}>
        <h2 style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)", fontWeight: 500 }}>Compare, narrow: stacked</h2>
        {renderCompare(COMPARE_DEMO_BODY)}
      </section>
    </main>
  );
}
