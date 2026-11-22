import type { KpiSpec } from "./spec";
import { formatCompact, formatFull } from "./format";

/** Reads the direction off a free-text delta ("-2.5% 5y CAGR" is down). */
export function deltaDirection(delta: string): "up" | "down" | "flat" {
  const t = delta.trim();
  if (/^[-−–]\s*\d/.test(t) || /^▼/.test(t)) return "down";
  if (/^\+\s*\d/.test(t) || /^▲/.test(t)) return "up";
  return "flat";
}

const ARROW = { up: "▲", down: "▼", flat: "" } as const;

/**
 * Stat tiles: label, a compact value (37.8M, full figure on hover and for screen readers),
 * and an optional delta. The delta stays in ink colours with an arrow: the spec does not say
 * whether up is good, so it never borrows the status colours.
 */
export function KpiTiles({ spec }: { spec: KpiSpec }) {
  return (
    <figure className="viz viz--kpi">
      {spec.title ? (
        <figcaption className="viz__head">
          <span className="viz__title">{spec.title}</span>
        </figcaption>
      ) : null}
      <ul className="viz-kpi">
        {spec.items.map((item, i) => {
          const full = typeof item.value === "number" ? formatFull(item.value) : item.value;
          const shown = typeof item.value === "number" ? formatCompact(item.value) : item.value;
          const dir = item.delta ? deltaDirection(item.delta) : "flat";
          const spoken = [item.label, full, item.unit, item.delta].filter(Boolean).join(", ");
          return (
            <li key={`${item.label}-${i}`} className="viz-kpi__tile" aria-label={spoken}>
              <span className="viz-kpi__label">{item.label}</span>
              <span className="viz-kpi__value" title={item.unit ? `${full} ${item.unit}` : full}>
                {shown}
                {item.unit ? <span className="viz-kpi__unit"> {item.unit}</span> : null}
              </span>
              {item.delta ? (
                <span className={`viz-kpi__delta viz-kpi__delta--${dir}`}>
                  {ARROW[dir] ? <span aria-hidden="true">{ARROW[dir]} </span> : null}
                  {item.delta}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
