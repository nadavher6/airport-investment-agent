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

/** A "nice" step (1, 2, 2.5 or 5 times a power of ten) for about `count` ticks over `span`. */
function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
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

/**
 * A rounded domain and its ticks. Zero is kept in view when the data sits near it,
 * so magnitudes are not exaggerated; a flat or single value still gets a real span.
 */
export function niceScale(values: readonly number[], count = 5, includeZero = true): Scale {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (includeZero || (lo >= 0 && lo <= hi / 2)) lo = Math.min(lo, 0);
  if (includeZero || (hi <= 0 && hi >= lo / 2)) hi = Math.max(hi, 0);
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) / 2;
    lo -= lo > 0 ? 0 : pad;
    hi += pad;
  }
  const step = niceStep(hi - lo, count);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toPrecision(12)));
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
