/** Number formatting and axis maths shared by the visuals. Pure functions, no DOM. */

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const fullFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 37760834 -> "37.8M", 1284 -> "1.3K", 950 -> "950". */
export function formatCompact(value: number): string {
  return Math.abs(value) < 1000 ? fullFmt.format(value) : compactFmt.format(value);
}

/** 37760834 -> "37,760,834". */
export function formatFull(value: number): string {
  return fullFmt.format(value);
}

/** An x value on an axis: years stay "2015", never "2,015". */
export function formatX(value: number | string): string {
  if (typeof value === "string") return value;
  return Number.isInteger(value) && Math.abs(value) < 10_000 ? String(value) : formatCompact(value);
}

export function withUnit(text: string, unit: string | undefined): string {
  return unit ? `${text} ${unit}` : text;
}

/** Most ticks a scale ever returns, whatever the data looks like. */
export const MAX_TICKS = 20;

/** A "nice" step (1, 2, 2.5 or 5 times a power of ten) for about `count` ticks over `span`. NaN if it has no sense. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  if (!Number.isFinite(raw) || raw <= 0) return NaN;
  const power = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / power;
  const nice = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10;
  return nice * power;
}

export interface Scale {
  min: number;
  max: number;
  ticks: number[];
}

/** The scale used when the data has no usable span (empty, not finite, or too wide for doubles). */
const UNIT_SCALE: Scale = { min: 0, max: 1, ticks: [0, 1] };

/**
 * A rounded domain and its ticks. Zero is kept in view when the data sits near it,
 * so magnitudes are not exaggerated; a flat or single value still gets a real span.
 * Never loops without end: at most MAX_TICKS ticks, and a degenerate span gives a unit scale.
 */
export function niceScale(values: readonly number[], count = 5, includeZero = true): Scale {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { ...UNIT_SCALE, ticks: [...UNIT_SCALE.ticks] };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (includeZero || (lo >= 0 && lo <= hi / 2)) lo = Math.min(lo, 0);
  if (includeZero || (hi <= 0 && hi >= lo / 2)) hi = Math.max(hi, 0);
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) / 2;
    lo -= lo > 0 ? 0 : pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, Math.min(count, MAX_TICKS));
  if (!(step > 0) || !Number.isFinite(step)) return { ...UNIT_SCALE, ticks: [...UNIT_SCALE.ticks] };
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const n = Math.round((max - min) / step);
  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(n) || n < 1 || n >= MAX_TICKS) {
    // Doubles too coarse for this step (values near 1e17), or an odd count: just the two ends.
    return min < max && Number.isFinite(min) && Number.isFinite(max)
      ? { min, max, ticks: [min, max] }
      : { ...UNIT_SCALE, ticks: [...UNIT_SCALE.ticks] };
  }
  const ticks: number[] = [];
  for (let i = 0; i <= n; i++) ticks.push(Number((min + i * step).toPrecision(12)));
  return { min, max, ticks };
}

/** Maps a value in [min, max] onto [a, b]. */
export function project(value: number, min: number, max: number, a: number, b: number): number {
  return max === min ? (a + b) / 2 : a + ((value - min) / (max - min)) * (b - a);
}

/** About `count` evenly spaced indexes out of `length`, always including the first and last. */
export function sampleIndexes(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = (length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}
