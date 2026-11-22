import "./compare.css";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { FenceBoundary } from "../../components/markdown/FenceBoundary";
import { Markdown } from "../../components/markdown/Markdown";
import { SpecView } from "../Visual";
import { VisualBoundary, VisualFallback } from "../fallback";
import { parseCompare, validateBlock, type CompareBlock, type CompareSpec } from "./spec";

export const COMPARE_NOTE = "Could not draw this comparison";

type Place = CSSProperties & Record<`--cmp-${string}`, string | number>;

/**
 * Where an item sits. Wide: one header track, then per spec row a label track and a cells track,
 * so cells of the same row share one grid row. Narrow (compare.css): one column, ordered by
 * `--cmp-order` so all of column A comes before column B.
 */
const place = (row: number, col: number | string, order: number): Place => ({
  "--cmp-row": row,
  "--cmp-col": col,
  "--cmp-order": order,
});

/** One block of a cell: markdown with the app's Markdown, a #33 spec with #33's own components. */
function BlockView({ block }: { block: CompareBlock }) {
  if (block.kind === "markdown") return <Markdown text={block.text} />;
  const result = validateBlock(block);
  if (result.ok) return <SpecView spec={result.spec} />;
  return <VisualFallback body={JSON.stringify(block.spec, null, 2)} reason={result.reason} json={block.spec} />;
}

function CompareView({ spec }: { spec: CompareSpec }) {
  const { columns, rows, title } = spec;
  // Items per column in the stacked order: its header, then one cell per row.
  const perColumn = rows.length + 1;
  const name = title ?? columns.join(" vs ");
  return (
    <div className="viz-compare" role="group" aria-label={`Comparison: ${name}`}>
      {title && <div className="viz-compare__title">{title}</div>}
      <div className="viz-compare__grid" style={{ "--cmp-cols": columns.length } as Place}>
        {columns.map((column, c) => (
          <div key={`h${c}`} className="viz-compare__head" data-row={1} data-col={c + 1} style={place(1, c + 1, c * perColumn)}>
            {column}
          </div>
        ))}
        {rows.map((row, r) => [
          <div key={`l${r}`} className="viz-compare__label" data-row={2 + 2 * r} style={place(2 + 2 * r, "1 / -1", 0)}>
            {row.label}
          </div>,
          ...row.cells.map((cell, c) => (
            <div
              key={`c${r}-${c}`}
              role="group"
              className="viz-compare__cell"
              aria-label={`${row.label}, ${columns[c] ?? ""}`}
              data-row={3 + 2 * r}
              data-col={c + 1}
              style={place(3 + 2 * r, c + 1, c * perColumn + r + 1)}
            >
              {/* Shown only when stacked, where the shared row label is hidden. */}
              <div className="viz-compare__cell-label" aria-hidden="true">
                {row.label}
              </div>
              {cell.map((block, b) => {
                const key = JSON.stringify(block);
                return (
                  <VisualBoundary key={`${b}:${key}`} body={key}>
                    <BlockView block={block} />
                  </VisualBoundary>
                );
              })}
            </div>
          )),
        ])}
      </div>
    </div>
  );
}

/** The whole-fence fallback: the raw body as code, with the note. */
export function CompareFallback({ body, reason }: { body: string; reason: string }) {
  return (
    <figure className="viz viz--fallback">
      <pre className="viz-code">
        <code>{body}</code>
      </pre>
      <p className="viz-note">{`${COMPARE_NOTE}: ${reason}.`}</p>
    </figure>
  );
}

function CompareFence({ body }: { body: string }) {
  const result = useMemo(() => parseCompare(body), [body]);
  if (result.ok) return <CompareView spec={result.spec} />;
  return <CompareFallback body={body} reason={result.reason} />;
}

/** The ```compare renderer, in the registry's shape. Never throws. */
export function renderCompare(body: string): ReactNode {
  return (
    <FenceBoundary key={body} fallback={<CompareFallback body={body} reason="it failed to render" />}>
      <CompareFence body={body} />
    </FenceBoundary>
  );
}
