import type { ReactNode } from "react";
import type { Cell } from "./spec";
import { formatFull } from "./format";

/** The categorical colour for series `index`, assigned in fixed order (never cycled past 8). */
export const seriesColor = (index: number): string => `var(--viz-${(index % 8) + 1})`;

export function formatCell(value: Cell): string {
  if (value === null) return "";
  return typeof value === "number" ? formatFull(value) : value;
}

interface SrTableProps {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly Cell[])[];
}

/** The chart's data as a real table, hidden visually but read by screen readers. */
export function SrTable({ caption, columns, rows }: SrTableProps) {
  return (
    <table className="viz-sr-only" data-testid="viz-sr-table">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r}>
            {row.map((cell, c) => (c === 0 ? <th key={c} scope="row">{formatCell(cell)}</th> : <td key={c}>{formatCell(cell)}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface LegendEntry {
  name: string;
  color: string;
}

/** Mirrors the mark: a short line key for lines, a square for bars. Text stays in ink colours. */
export function Legend({ entries, mark }: { entries: readonly LegendEntry[]; mark: "line" | "rect" }) {
  return (
    <ul className="viz-legend" aria-hidden="true">
      {entries.map((e) => (
        <li key={e.name} className="viz-legend__item">
          <span className={`viz-legend__key viz-legend__key--${mark}`} style={{ background: e.color }} />
          {e.name}
        </li>
      ))}
    </ul>
  );
}

interface FrameProps {
  title: string | undefined;
  subtitle?: string | undefined;
  children: ReactNode;
}

/** The card every visual sits in: title, optional subtitle, then the body. */
export function VisualFrame({ title, subtitle, children }: FrameProps) {
  return (
    <figure className="viz">
      {title || subtitle ? (
        <figcaption className="viz__head">
          {title ? <span className="viz__title">{title}</span> : null}
          {subtitle ? <span className="viz__subtitle">{subtitle}</span> : null}
        </figcaption>
      ) : null}
      {children}
    </figure>
  );
}
