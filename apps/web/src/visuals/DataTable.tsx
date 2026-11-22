import type { TableSpec } from "./spec";
import { formatCell } from "./parts";

/** A plain HTML table. Numeric columns align right in tabular figures. */
export function DataTable({ spec, note }: { spec: Pick<TableSpec, "title" | "columns" | "rows">; note?: string }) {
  const numericCol = spec.columns.map(
    (_, c) => spec.rows.length > 0 && spec.rows.every((r) => r[c] === null || typeof r[c] === "number"),
  );
  return (
    <figure className="viz viz--table">
      {spec.title ? (
        <figcaption className="viz__head">
          <span className="viz__title">{spec.title}</span>
        </figcaption>
      ) : null}
      <div className="viz-table__scroll">
        <table className="viz-table">
          {spec.title ? <caption className="viz-sr-only">{spec.title}</caption> : null}
          <thead>
            <tr>
              {spec.columns.map((c, i) => (
                <th key={i} scope="col" className={numericCol[i] ? "viz-num" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((row, r) => (
              <tr key={r}>
                {spec.columns.map((_, c) => (
                  <td key={c} className={numericCol[c] ? "viz-num" : undefined}>
                    {formatCell(row[c] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <p className="viz-note">{note}</p> : null}
    </figure>
  );
}
