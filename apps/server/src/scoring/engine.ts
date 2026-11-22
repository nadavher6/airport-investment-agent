/**
 * Generic composite-indicator scoring engine (tasks/06-scoring-formula-research.md).
 * Each KPI's raw value goes through a FIXED scale on the airport's own number (no population, no
 * min-max, no winsorizing: #75), then a weighted linear aggregate, with weights renormalized over the
 * KPIs that are actually available so a partial model still yields a 0-100 score plus an honest `coverage`.
 * So an airport's sub-scores and final score never depend on which other airports exist or are compared.
 */

export type Direction = "higher" | "lower";

/**
 * How a KPI's raw value becomes a 0-100 sub-score. Both kinds are fixed scales on the item's own value:
 * - `{ kind: "percent", fullAt }`: the raw value is a percentage (0-100 points, as T-100 stores it) and `fullAt` is
 *   the share, as a FRACTION, that scores 100. Sub-score = share / fullAt * 100, capped at 100 (fullAt 1.0: 87% -> 87;
 *   fullAt 0.5: 40% -> 80).
 * - `{ kind: "linear", zeroAt, fullAt }`: the raw value, in its own unit, scores 0 at `zeroAt` and 100 at `fullAt`,
 *   linearly in between and clamped outside (growth: zeroAt -10, fullAt 10 %/yr, so 0%/yr -> 50 and -2.5 -> 37.5).
 */
export type Scale =
  | { readonly kind: "percent"; readonly fullAt: number }
  | { readonly kind: "linear"; readonly zeroAt: number; readonly fullAt: number };

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
  /** How the raw value becomes a 0-100 sub-score (a fixed scale). `{ kind: "percent", fullAt }` needs a raw value in percent points. */
  readonly scale: Scale;
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
  /** 0-100 on the KPI's fixed scale (share ÷ fullAt × 100, or the linear zeroAt..fullAt scale); null when unavailable. */
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

/**
 * The "percent" scale. `share` is a FRACTION (0.40 = 40%); `fullAt` is the fraction that scores 100.
 * Sub-score = share / fullAt * 100, clamped to 0-100, one decimal ("lower" = 100 − score).
 * NaN and ±Infinity are missing (null).
 */
export function percentScore(share: number, direction: Direction, fullAt: number): number | null {
  if (!Number.isFinite(share) || !Number.isFinite(fullAt) || fullAt <= 0) return null;
  const clamped = Math.min(100, Math.max(0, (share / fullAt) * 100));
  return Math.round((direction === "higher" ? clamped : 100 - clamped) * 10) / 10;
}

/**
 * The "linear" scale: `raw` scores 0 at `zeroAt` and 100 at `fullAt`, clamped to 0-100, one decimal
 * ("lower" = 100 − score). NaN, ±Infinity and a degenerate scale (fullAt = zeroAt) are missing (null).
 */
export function linearScore(raw: number, direction: Direction, zeroAt: number, fullAt: number): number | null {
  if (!Number.isFinite(raw) || !Number.isFinite(zeroAt) || !Number.isFinite(fullAt) || fullAt === zeroAt) return null;
  const clamped = Math.min(100, Math.max(0, ((raw - zeroAt) * 100) / (fullAt - zeroAt)));
  return Math.round((direction === "higher" ? clamped : 100 - clamped) * 10) / 10;
}

/** A finite raw value to its 0-100 sub-score by the KPI's scale (an exhaustive switch: a new kind fails to compile). */
function subScore<A>(k: KpiDef<A>, raw: number): number | null {
  const scale: Scale = k.scale;
  switch (scale.kind) {
    case "percent":
      return percentScore(raw / 100, k.direction, scale.fullAt);
    case "linear":
      return linearScore(raw, k.direction, scale.zeroAt, scale.fullAt);
    default: {
      const unreachable: never = scale;
      throw new Error(`Unknown scale: ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Options for `buildScorer`. There is no reference population: every scale is fixed (#75). */
export interface ScorerOptions<A> {
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

/** Build a scorer from the KPI definitions. Each item is scored on its own values only. */
export function buildScorer<A>(kpis: readonly KpiDef<A>[], opts: ScorerOptions<A> = {}): Scorer<A> {
  const score = (item: A): ScoredItem<A> => {
    const availableWeight = kpis
      .filter((k) => {
        const v = k.extract(item);
        return v !== null && Number.isFinite(v);
      })
      .reduce((sum, k) => sum + k.weight, 0);
    const totalWeight = kpis.reduce((sum, k) => sum + k.weight, 0);

    const missing: string[] = [];
    let composite = 0;
    const breakdown: KpiBreakdown[] = kpis.map((k) => {
      const raw = k.extract(item);
      const noteField = k.note !== undefined ? { note: k.note } : {};
      const evidenceField = k.evidence ? { evidence: k.evidence(item) } : {};
      const scored = raw === null || !Number.isFinite(raw) ? null : subScore(k, raw);
      if (raw === null || scored === null) {
        missing.push(k.key);
        return { key: k.key, label: k.label, weight: k.weight, available: false, raw: null, normalized: null, contribution: null, ...noteField, ...evidenceField };
      }
      const normalized = scored;
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
