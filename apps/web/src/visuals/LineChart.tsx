import { useMemo, useState, type KeyboardEvent } from "react";
import type { Cell, LineSpec } from "./spec";
import { formatCompact, formatFull, formatX, niceScale, project, sampleIndexes, withUnit } from "./format";
import { Legend, SrTable, VisualFrame, seriesColor } from "./parts";

const W = 640;
const H = 260;
const M = { top: 16, right: 72, bottom: 44, left: 56 };
const LABEL_GAP = 14;

type X = number | string;

/**
 * What the chart draws: a fence LineSpec, or (from a tool view, #67) points whose value is null for a year
 * with no data. A null breaks the line into a gap; it is never drawn as zero or bridged.
 */
export interface LineChartSpec extends Omit<LineSpec, "type" | "series"> {
  readonly series: ReadonlyArray<{ readonly name: string; readonly points: ReadonlyArray<readonly [X, number | null]> }>;
}

/** A subtle vertical annotation at one x (e.g. "2019 baseline"); the label sits on the `side` of the line. */
export interface LineMarker {
  readonly x: X;
  readonly label: string;
  readonly side?: "left" | "right";
}

type Point = readonly [X, number];
const present = (pts: ReadonlyArray<readonly [X, number | null]>): Point[] =>
  pts.filter((p): p is Point => p[1] !== null);

/** Every x in the spec, in order: numeric x sorts, text x keeps first-seen order. */
function collectXs(spec: LineChartSpec): { xs: X[]; numeric: boolean } {
  const all = spec.series.flatMap((s) => s.points.map((p) => p[0]));
  const numeric = all.every((x) => typeof x === "number");
  const xs = [...new Set(all)];
  if (numeric) (xs as number[]).sort((a, b) => a - b);
  return { xs, numeric };
}

export function summariseLine(spec: LineChartSpec, xs: readonly X[]): string {
  const first = xs[0] ?? "";
  const last = xs[xs.length - 1] ?? "";
  const parts = spec.series.map((s) => {
    const pts = present(s.points);
    const a = pts[0];
    const b = pts[pts.length - 1];
    const gaps = s.points.filter((p) => p[1] === null).map((p) => formatX(p[0]));
    const head = a && b ? `${s.name} from ${formatCompact(a[1])} to ${formatCompact(b[1])}` : `${s.name} (no data)`;
    return gaps.length > 0 && a ? `${head}, no data for ${gaps.join(", ")}` : head;
  });
  const head = spec.title ? `${spec.title}. ` : "";
  return `${head}Line chart of ${spec.series.length} series, ${formatX(first)} to ${formatX(last)}${spec.unit ? `, in ${spec.unit}` : ""}: ${parts.join("; ")}.`;
}

export function LineChart({ spec, markers = [] }: { spec: LineChartSpec; markers?: readonly LineMarker[] }) {
  const [active, setActive] = useState<number | null>(null);
  const { xs, numeric, y, xMin, xMax, xTicks, label } = useMemo(() => {
    const { xs, numeric } = collectXs(spec);
    const ys = spec.series.flatMap((s) => present(s.points).map((p) => p[1]));
    const xNums = xs.map((x, i) => (numeric ? (x as number) : i));
    const xMin = Math.min(...xNums);
    const xMax = Math.max(...xNums);
    // Numeric x gets round, evenly spaced ticks (2016, 2018, ...); text x gets every k-th label.
    const xTicks: X[] = numeric
      ? niceScale(xNums, 6, false).ticks.filter((t) => t >= xMin && t <= xMax && (xMax - xMin > 10 || Number.isInteger(t)))
      : sampleIndexes(xs.length, 7).map((i) => xs[i] as X);
    return { xs, numeric, y: niceScale(ys, 5, false), xMin, xMax, xTicks, label: summariseLine(spec, xs) };
  }, [spec]);
  const plotL = M.left;
  const plotR = W - M.right;
  const plotT = M.top;
  const plotB = H - M.bottom;
  const px = (x: X): number => project(numeric ? (x as number) : xs.indexOf(x), xMin, xMax, plotL, plotR);
  const py = (v: number): number => project(v, y.min, y.max, plotB, plotT);

  /** The value at x: a number, null for a gap the data names, undefined when the series has no such x. */
  const valueAt = (seriesIndex: number, x: X): number | null | undefined =>
    spec.series[seriesIndex]?.points.find((p) => p[0] === x)?.[1];

  // Direct end labels only when they would not collide; the legend carries identity otherwise.
  const ends = spec.series.flatMap((s, i) => {
    const pts = present(s.points);
    if (pts.length === 0) return [];
    const last = pts.reduce((a, b) => (px(b[0]) >= px(a[0]) ? b : a));
    return [{ i, x: px(last[0]), y: py(last[1]), value: last[1], name: s.name }];
  });
  const sortedEndY = ends.map((e) => e.y).sort((a, b) => a - b);
  const endsClear = sortedEndY.every((v, i) => i === 0 || v - (sortedEndY[i - 1] ?? 0) >= LABEL_GAP);
  const directLabels = spec.series.length <= 4 && endsClear;
  const activeX = active === null ? undefined : xs[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(xs.length - 1, Math.max(0, (a ?? (step > 0 ? -1 : xs.length)) + step)));
    } else if (e.key === "Escape") setActive(null);
  };

  const rows: Cell[][] = xs.map((x) => [formatX(x), ...spec.series.map((_, i) => valueAt(i, x) ?? null)]);

  // A line is broken at each null (a gap, never bridged); a point with gaps on both sides gets its own dot.
  const segments = (s: LineChartSpec["series"][number]): Point[][] => {
    const runs: Point[][] = [[]];
    for (const p of [...s.points].sort((a, b) => px(a[0]) - px(b[0]))) {
      if (p[1] === null) runs.push([]);
      else runs[runs.length - 1]!.push([p[0], p[1]]);
    }
    return runs.filter((r) => r.length > 0);
  };

  return (
    <VisualFrame title={spec.title} subtitle={spec.unit ? `in ${spec.unit}` : undefined}>
      {spec.series.length >= 2 ? (
        <Legend entries={spec.series.map((s, i) => ({ name: s.name, color: seriesColor(i) }))} mark="line" />
      ) : null}
      <div
        className="viz__plot"
        role="group"
        tabIndex={0}
        aria-label={`${spec.title ?? "Line chart"}: use the arrow keys to read values`}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? xs.length - 1)}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="viz__svg" role="img" aria-label={label}>
          <g className="viz-grid">
            {y.ticks.map((t) => (
              <g key={t}>
                <line x1={plotL} x2={plotR} y1={py(t)} y2={py(t)} />
                <text className="viz-tick" x={plotL - 8} y={py(t)} dy="0.32em" textAnchor="end">
                  {formatCompact(t)}
                </text>
              </g>
            ))}
          </g>
          <line className="viz-axis" x1={plotL} x2={plotR} y1={plotB} y2={plotB} />
          {xTicks.map((x) => (
            <text key={String(x)} className="viz-tick" x={px(x)} y={plotB + 18} textAnchor="middle">
              {formatX(x)}
            </text>
          ))}
          {spec.x ? (
            <text className="viz-axis-title" x={(plotL + plotR) / 2} y={H - 4} textAnchor="middle">
              {spec.x}
            </text>
          ) : null}
          {markers
            .filter((m) => xs.includes(m.x))
            .map((m) => {
              const x = px(m.x);
              const right = m.side === "right";
              return (
                <g key={`marker-${String(m.x)}`} className="viz-marker" data-testid="line-marker">
                  <line x1={x} x2={x} y1={plotT} y2={plotB} />
                  <text className="viz-marker__label" x={right ? x + 4 : x - 4} y={plotT - 4} textAnchor={right ? "start" : "end"}>
                    {m.label}
                  </text>
                </g>
              );
            })}
          {spec.series.map((s, i) => {
            const runs = segments(s);
            const d = runs
              .map((run) => run.map((p, k) => `${k === 0 ? "M" : "L"}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(""))
              .join("");
            return (
              <g key={s.name + i}>
                <path className="viz-line" d={d} style={{ stroke: seriesColor(i) }} />
                {runs
                  .filter((run) => run.length === 1)
                  .map(([p]) => (
                    <circle key={String(p![0])} className="viz-dot" cx={px(p![0])} cy={py(p![1])} r={4} style={{ fill: seriesColor(i) }} />
                  ))}
              </g>
            );
          })}
          {activeX !== undefined ? (
            <line className="viz-crosshair" x1={px(activeX)} x2={px(activeX)} y1={plotT} y2={plotB} />
          ) : null}
          {ends.map((e) => (
            <circle key={e.i} className="viz-dot" cx={e.x} cy={e.y} r={4} style={{ fill: seriesColor(e.i) }} />
          ))}
          {activeX !== undefined
            ? spec.series.map((_, i) => {
                const v = valueAt(i, activeX);
                return v === undefined || v === null ? null : (
                  <circle key={i} className="viz-dot" cx={px(activeX)} cy={py(v)} r={4} style={{ fill: seriesColor(i) }} />
                );
              })
            : null}
          {directLabels
            ? ends.map((e) => (
                <text key={e.i} className="viz-label" x={e.x + 8} y={e.y} dy="0.32em">
                  {spec.series.length > 1 ? `${e.name} ${formatCompact(e.value)}` : formatCompact(e.value)}
                </text>
              ))
            : null}
          {xs.map((x, k) => {
            const left = k === 0 ? plotL : (px(xs[k - 1] as X) + px(x)) / 2;
            const right = k === xs.length - 1 ? plotR : (px(x) + px(xs[k + 1] as X)) / 2;
            return (
              <rect
                key={String(x)}
                className="viz-hit"
                x={left}
                y={plotT}
                width={Math.max(1, right - left)}
                height={plotB - plotT}
                onMouseEnter={() => setActive(k)}
              />
            );
          })}
        </svg>
        {activeX !== undefined ? (
          <div
            className="viz-tooltip"
            role="status"
            style={{ left: `${(px(activeX) / W) * 100}%` }}
          >
            <div className="viz-tooltip__x">{formatX(activeX)}</div>
            {spec.series.map((s, i) => {
              const v = valueAt(i, activeX);
              return v === undefined ? null : (
                <div key={i} className="viz-tooltip__row">
                  <span className="viz-tooltip__key" style={{ background: seriesColor(i) }} />
                  <strong>{v === null ? "No data" : withUnit(formatFull(v), spec.unit)}</strong>
                  <span className="viz-tooltip__name">{s.name}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <SrTable caption={label} columns={[spec.x ?? "x", ...spec.series.map((s) => s.name)]} rows={rows} />
    </VisualFrame>
  );
}
