import { DEMO_FENCES } from "./faaDemo";
import { renderVisual } from "../Visual";
import { renderCompare } from "../compare/Compare";
import { COMPARE_DEMO_BODY } from "../compare/demo";
import "../../components/blocks/blocks.css";
import { ToolUseBlockView } from "../../components/blocks/ToolUseBlockView";
import { SCORE_FIVE, SCORE_ONE, SCORE_TWO } from "../score/fixtures";
import { asToolCallId, type JsonValue } from "@airport/shared";

const SCORE_CASES: { title: string; output: JsonValue }[] = [
  { title: "score_airports (#41): 1 airport, report", output: SCORE_ONE },
  { title: "score_airports (#41): 2 airports, side by side", output: SCORE_TWO },
  { title: "score_airports (#41): 5 airports, table", output: SCORE_FIVE },
];

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
  // ?only=compare shows just the #39 comparison (for screenshots).
  // ?only=score shows just the #41 score_airports cases (for screenshots).
  const only = new URLSearchParams(location.search).get("only");
  const onlyCompare = only === "compare";
  if (only === "score") {
    return (
      <main style={{ maxWidth: "var(--column)", margin: "0 auto", padding: "var(--space-5)" }}>
        {SCORE_CASES.map((c, i) => (
          <section key={c.title} style={{ marginBottom: "var(--space-6)" }}>
            <h2 style={{ fontSize: "var(--text-sm)", color: "var(--ink-3)", fontWeight: 500 }}>{c.title}</h2>
            <ToolUseBlockView
              block={{ type: "tool_use", toolCallId: asToolCallId(`score-${i}`), name: "score_airports", input: {}, status: "succeeded", output: c.output }}
            />
          </section>
        ))}
      </main>
    );
  }
  return (
    <main style={{ maxWidth: "var(--column)", margin: "0 auto", padding: "var(--space-5)" }}>
      {(onlyCompare ? [] : [...DEMO_FENCES, ...broken]).map((f) => (
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
