import { useMemo, useState } from "react";
import type { BarSpec } from "./spec";
import { formatCompact, formatFull, niceScale, project, withUnit } from "./format";
import { SrTable, VisualFrame, seriesColor } from "./parts";

const W = 640;
const ROW = 32;
const BAR = 20; // <= 24px: the band's leftover is air
const M = { top: 8, right: 64, bottom: 8, left: 120 };
const R = 4; // rounded data end, square at the baseline

/** Category labels get about 120px; longer ones are cut, with the full text kept in a <title>. */
const shortLabel = (s: string): string => (s.length > 18 ? `${s.slice(0, 17)}…` : s);

export function sortItems(spec: BarSpec): BarSpec["items"] {
  const items = [...spec.items];
  if (spec.sort === "desc") items.sort((a, b) => b.value - a.value);
  if (spec.sort === "asc") items.sort((a, b) => a.value - b.value);
  return items;
}

export function summariseBar(spec: BarSpec, items: BarSpec["items"]): string {
  const top = [...items].sort((a, b) => b.value - a.value)[0];
  const head = spec.title ? `${spec.title}. ` : "";
  const lead = top ? `; highest ${top.label} at ${formatCompact(top.value)}` : "";
  return `${head}Bar chart of ${items.length} items${spec.unit ? `, in ${spec.unit}` : ""}${lead}.`;
}

/** A horizontal bar from x0 to x1 with only the far (data) end rounded. */
function barPath(x0: number, x1: number, y: number, h: number): string {
  const w = Math.abs(x1 - x0);
  const r = Math.min(R, w, h / 2);
  const dir = x1 >= x0 ? 1 : -1;
  const end = x1 - dir * r;
  return [
    `M${x0},${y}`,
    `H${end}`,
    `Q${x1},${y} ${x1},${y + r}`,
    `V${y + h - r}`,
    `Q${x1},${y + h} ${end},${y + h}`,
    `H${x0}`,
    "Z",
  ].join("");
}

export function BarChart({ spec }: { spec: BarSpec }) {
  const [active, setActive] = useState<number | null>(null);
  const { items, scale, label } = useMemo(() => {
    const sorted = sortItems(spec);
    return {
      items: sorted,
      scale: niceScale(sorted.map((i) => i.value), 4, true),
      label: summariseBar(spec, sorted),
    };
  }, [spec]);
  const H = M.top + M.bottom + items.length * ROW;
  const px = (v: number): number => project(v, scale.min, scale.max, M.left, W - M.right);
  const base = px(0);

  return (
    <VisualFrame title={spec.title} subtitle={spec.unit ? `in ${spec.unit}` : undefined}>
      <div className="viz__plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="viz__svg" role="img" aria-label={label}>
          {items.map((item, k) => {
            const y = M.top + k * ROW + (ROW - BAR) / 2;
            const x1 = px(item.value);
            const negative = item.value < 0;
            return (
              <g
                key={`${item.label}-${k}`}
                className={active === k ? "viz-bar viz-bar--active" : "viz-bar"}
                onMouseEnter={() => setActive(k)}
                onMouseLeave={() => setActive(null)}
              >
                <rect className="viz-hit" x={0} y={M.top + k * ROW} width={W} height={ROW} />
                <text className="viz-category" x={M.left - 10} y={y + BAR / 2} dy="0.32em" textAnchor="end">
                  <title>{item.label}</title>
                  {shortLabel(item.label)}
                </text>
                {item.value !== 0 ? (
                  <path d={barPath(base, x1, y, BAR)} style={{ fill: seriesColor(0) }} />
                ) : null}
                <text
                  className="viz-label"
                  x={negative ? x1 - 6 : x1 + 6}
                  y={y + BAR / 2}
                  dy="0.32em"
                  textAnchor={negative ? "end" : "start"}
                >
                  {active === k ? withUnit(formatFull(item.value), spec.unit) : formatCompact(item.value)}
                </text>
              </g>
            );
          })}
          <line className="viz-axis" x1={base} x2={base} y1={M.top} y2={H - M.bottom} />
        </svg>
      </div>
      <SrTable
        caption={label}
        columns={["Item", spec.unit ?? "Value"]}
        rows={items.map((i) => [i.label, i.value])}
      />
    </VisualFrame>
  );
}
