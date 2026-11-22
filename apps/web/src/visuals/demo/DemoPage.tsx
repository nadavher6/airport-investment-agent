import { DEMO_FENCES } from "./faaDemo";
import { renderVisual } from "../Visual";

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
    </main>
  );
}
