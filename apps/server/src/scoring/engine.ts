/**
 * Generic composite-indicator scoring engine (tasks/06-scoring-formula-research.md).
 * Pipeline per the OECD/JRC Handbook: winsorize -> min-max normalize -> weighted linear
 * aggregate, with weights renormalized over the KPIs that are actually available so a
 * partial model (v0) still yields a comparable 0-100 score plus an honest `coverage`.
 */

export type Direction = "higher" | "lower";

/**
 * How a KPI's raw value becomes a 0-100 sub-score:
 * - "minmax" (default): winsorize, then min-max against the reference bounds (relative to the population);
 * - "percent": the raw value is already a percentage, so the sub-score IS the value, clamped to 0-100
 *   (87 -> 87, 108.3 -> 100). No winsorizing and no bounds, so it is the same in absolute and relative mode.
 */
export type Scale = "minmax" | "percent";

/** The "show your work" record for one KPI: the formula, the raw inputs, and a plain sentence. */
export interface KpiEvidence {
  /** The formula in words, e.g. "international seats ÷ total seats". */
  readonly formula: string;
  /** The raw inputs that went into the value (named numbers). */
  readonly inputs: Readonly<Record<string, number | string | null>>;
  /** The computed raw KPI value, or null when it can't be computed. */
  readonly value: number | null;
  /** One plain-English sentence, with the actual numbers in it. */
  readonly explanation: string;
}

/** One KPI: how to pull a raw value from an item, its target weight, and its direction. */
export interface KpiDef<A> {
  readonly key: string;
  readonly label: string;
  /** Target weight in the full model (weights are renormalized over available KPIs). */
  readonly weight: number;
  /** "higher" = larger raw value is more attractive; "lower" = inverse. */
  readonly direction: Direction;
  /** How the raw value becomes a 0-100 sub-score; default "minmax". "percent" needs a raw value in percent. */
  readonly scale?: Scale;
  /** Assumption / proxy note, surfaced so the agent can explain and caveat. */
  readonly note?: string;
  /** Raw value for this item, or null when the KPI can't be computed for it. */
  extract(item: A): number | null;
  /** The evidence (formula + inputs + sentence) behind this KPI for the item. */
  evidence?(item: A): KpiEvidence;
}

export interface KpiBreakdown {
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly available: boolean;
  readonly raw: number | null;
  /** 0-100 after winsorize + min-max (or the percentage itself for scale "percent"); null when unavailable. */
  readonly normalized: number | null;
  /** renormalized-weight × normalized; null when unavailable. */
  readonly contribution: number | null;
  readonly note?: string;
  /** The formula + inputs + sentence behind this KPI. */
  readonly evidence?: KpiEvidence;
}

export interface ScoredItem<A> {
  readonly item: A;
  /** 0-100 composite, over the available KPIs. */
  readonly score: number;
  /** Share of total target weight actually computed (1 = full model). */
  readonly coverage: number;
  /** Keys of KPIs that could not be computed. */
  readonly missing: readonly string[];
  readonly kpis: readonly KpiBreakdown[];
}

export interface Scorer<A> {
  score(item: A): ScoredItem<A>;
  rank(items: readonly A[]): ScoredItem<A>[];
}

interface Bounds {
  readonly lo: number;
  readonly hi: number;
}

const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(((p / 100) * (sorted.length - 1)))));
  return sorted[idx] as number;
};

/** Winsorized [lo, hi] bounds for a KPI across the reference population. */
function boundsFor(values: readonly number[], lowP: number, highP: number): Bounds {
  const sorted = [...values].sort((a, b) => a - b);
  return { lo: percentile(sorted, lowP), hi: percentile(sorted, highP) };
}

/** Min-max to 0-100 with winsor clamping and directionality. Degenerate range -> 50 (neutral). */
export function normalize(raw: number, bounds: Bounds, direction: Direction): number {
  const { lo, hi } = bounds;
  if (hi <= lo) return 50;
  const clamped = Math.min(hi, Math.max(lo, raw));
  const unit = (clamped - lo) / (hi - lo);
  const oriented = direction === "higher" ? unit : 1 - unit;
  return Math.round(oriented * 1000) / 10; // 0-100, one decimal
}

/** The "percent" scale: the raw percentage itself, clamped to 0-100, one decimal ("lower" = 100 − value). */
export function percentScore(raw: number, direction: Direction): number {
  const clamped = Math.min(100, Math.max(0, raw));
  return Math.round((direction === "higher" ? clamped : 100 - clamped) * 10) / 10;
}

/**
 * Build a scorer from a reference population: KPI bounds are computed once from `reference`,
 * so any item (even a single one) is scored on the same fixed, comparable scale.
 */
export interface ScorerOptions<A> {
  /** Winsor percentiles [low, high]; default [5, 95]. */
  readonly winsor?: readonly [number, number];
  /**
   * Key used to order items with an equal score (ascending, by code point, so it does not depend on
   * the locale). Without it, ties keep the caller's input order, so the ranking is not deterministic.
   */
  readonly tieBreak?: (item: A) => string;
}

/** Score descending, then the tie-break key ascending (plain code-point order). */
export function compareRanked<A>(tieBreak?: (item: A) => string): (a: ScoredItem<A>, b: ScoredItem<A>) => number {
  return (a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (!tieBreak) return 0;
    const ka = tieBreak(a.item);
    const kb = tieBreak(b.item);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

export function buildScorer<A>(
  reference: readonly A[],
  kpis: readonly KpiDef<A>[],
  opts: ScorerOptions<A> = {},
): Scorer<A> {
  const [lowP, highP] = opts.winsor ?? [5, 95];
  const bounds = new Map<string, Bounds>();
  for (const kpi of kpis) {
    const values = reference.map((r) => kpi.extract(r)).filter((v): v is number => v !== null && Number.isFinite(v));
    bounds.set(kpi.key, boundsFor(values, lowP, highP));
  }

  const score = (item: A): ScoredItem<A> => {
    const availableWeight = kpis
      .filter((k) => k.extract(item) !== null)
      .reduce((sum, k) => sum + k.weight, 0);
    const totalWeight = kpis.reduce((sum, k) => sum + k.weight, 0);

    const missing: string[] = [];
    let composite = 0;
    const breakdown: KpiBreakdown[] = kpis.map((k) => {
      const raw = k.extract(item);
      const noteField = k.note !== undefined ? { note: k.note } : {};
      const evidenceField = k.evidence ? { evidence: k.evidence(item) } : {};
      if (raw === null || !Number.isFinite(raw)) {
        missing.push(k.key);
        return { key: k.key, label: k.label, weight: k.weight, available: false, raw: null, normalized: null, contribution: null, ...noteField, ...evidenceField };
      }
      const normalized =
        k.scale === "percent" ? percentScore(raw, k.direction) : normalize(raw, bounds.get(k.key) as Bounds, k.direction);
      const renormWeight = availableWeight > 0 ? k.weight / availableWeight : 0;
      const contribution = Math.round(renormWeight * normalized * 10) / 10;
      composite += renormWeight * normalized;
      return { key: k.key, label: k.label, weight: k.weight, available: true, raw, normalized, contribution, ...noteField, ...evidenceField };
    });

    return {
      item,
      score: Math.round(composite * 10) / 10,
      coverage: totalWeight > 0 ? Math.round((availableWeight / totalWeight) * 100) / 100 : 0,
      missing,
      kpis: breakdown,
    };
  };

  return {
    score,
    rank: (items) => items.map(score).sort(compareRanked(opts.tieBreak)),
  };
}
