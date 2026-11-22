import { Component, type ErrorInfo, type ReactNode } from "react";
import { LIMITS, type Cell } from "./spec";
import { DataTable } from "./DataTable";

export const NOTE = "Could not draw this chart";

export interface CoercedTable {
  title?: string;
  columns: string[];
  rows: Cell[][];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clip = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function toCell(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : String(v);
  if (typeof v === "string") return clip(v, LIMITS.cell);
  if (typeof v === "boolean") return String(v);
  try {
    return clip(JSON.stringify(v), LIMITS.cell);
  } catch {
    return null;
  }
}

function finish(title: unknown, columns: unknown[], rows: unknown[][]): CoercedTable | null {
  const cols = columns.slice(0, LIMITS.columns).map((c, i) => clip(String(c ?? `Column ${i + 1}`), LIMITS.label));
  if (cols.length === 0 || rows.length === 0) return null;
  const table: CoercedTable = {
    columns: cols,
    rows: rows.slice(0, LIMITS.rows).map((r) => cols.map((_, c) => toCell(r[c]))),
  };
  if (typeof title === "string" && title.trim()) table.title = clip(title.trim(), LIMITS.title);
  return table;
}

function fromObjects(title: unknown, list: unknown[]): CoercedTable | null {
  const objects = list.filter(isRecord);
  if (objects.length === 0) return null;
  const keys = [...new Set(objects.flatMap((o) => Object.keys(o)))];
  return finish(title, keys, objects.map((o) => keys.map((k) => o[k])));
}

/**
 * Best effort: turn JSON that failed validation into a plain table, so the numbers still show.
 * Knows the shapes of the four specs (table, line series, bar or kpi items) and generic arrays.
 * Returns null when nothing table-like is there. Never throws.
 */
export function coerceToTable(json: unknown): CoercedTable | null {
  try {
    if (Array.isArray(json)) {
      if (json.every(Array.isArray)) {
        const [head, ...rest] = json as unknown[][];
        return head ? finish(undefined, head, rest) : null;
      }
      return fromObjects(undefined, json);
    }
    if (!isRecord(json)) return null;
    const { title } = json;
    if (Array.isArray(json.rows)) {
      const rows = json.rows.filter(Array.isArray) as unknown[][];
      const width = Math.max(0, ...rows.map((r) => r.length));
      const columns = Array.isArray(json.columns) ? json.columns : Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
      if (rows.length > 0) return finish(title, columns, rows);
      return fromObjects(title, json.rows);
    }
    if (Array.isArray(json.series)) {
      const series = json.series.filter(isRecord);
      const points = series.map((s) => (Array.isArray(s.points) ? s.points.filter(Array.isArray) : []) as unknown[][]);
      const xs = [...new Set(points.flatMap((p) => p.map((pt) => JSON.stringify(pt[0] ?? null))))];
      if (xs.length === 0) return null;
      const columns = [typeof json.x === "string" ? json.x : "x", ...series.map((s, i) => s.name ?? `Series ${i + 1}`)];
      const rows = xs.map((x) => [JSON.parse(x) as unknown, ...points.map((p) => p.find((pt) => JSON.stringify(pt[0] ?? null) === x)?.[1])]);
      return finish(title, columns, rows);
    }
    if (Array.isArray(json.items)) return fromObjects(title, json.items);
    return null;
  } catch {
    return null;
  }
}

/** The safe fallback: the coerced table when there is one, else the raw body as code; always with the note. */
export function VisualFallback({ body, reason, json }: { body: string; reason: string; json?: unknown }) {
  const table = json === undefined ? null : coerceToTable(json);
  const note = `${NOTE}: ${reason}.`;
  if (table) return <DataTable spec={table} note={note} />;
  return (
    <figure className="viz viz--fallback">
      <pre className="viz-code">
        <code>{body}</code>
      </pre>
      <p className="viz-note">{note}</p>
    </figure>
  );
}

interface BoundaryProps {
  body: string;
  children: ReactNode;
}

/** Catches a render error inside one visual: the message keeps rendering, the visual shows its code. */
export class VisualBoundary extends Component<BoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("A visual failed to render", error, info.componentStack);
  }

  override render() {
    if (this.state.failed) return <VisualFallback body={this.props.body} reason="it failed to render" />;
    return this.props.children;
  }
}
