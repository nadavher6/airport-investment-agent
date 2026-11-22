import { KpiTiles } from "../KpiTiles";
import { seriesColor } from "../parts";
import {
  CATEGORIES,
  formatIntlFlights,
  formatIntlPassengers,
  formatScore,
  formatShare,
  internationalFlights,
  missingText,
  type Category,
  type CategoryKey,
  type Evidence,
  type RankedAirport,
} from "./spec";

/**
 * The long-haul KPI's international flights and passengers (#74), shown next to its evidence and not scored.
 * Draws nothing for any other category; "—" when the count is missing.
 */
export function InternationalFlightsLine({ evidence }: { evidence: Evidence | null | undefined }) {
  const f = internationalFlights(evidence);
  if (f === null) return null;
  return (
    <p className="score-cat__intl" data-testid="intl-flights">
      <span className="score-cat__intl-label">International flights:</span> <span data-testid="intl-flights-value">{formatIntlFlights(f)}</span>
      {" · "}
      <span className="score-cat__intl-label">International passengers:</span> <span data-testid="intl-passengers-value">{formatIntlPassengers(f)}</span>
    </p>
  );
}

/** A category is shown as computed only when the tool says so and a sub-score is there. */
export const isComputed = (cat: Category): cat is Category & { subScore: number } =>
  cat.available && cat.subScore !== null;

/** The category's own label from the data, or its key when the label is blank. */
export const categoryLabel = (airport: RankedAirport | undefined, key: CategoryKey): string =>
  airport?.breakdown[key].label.trim() || key;

/**
 * A 0-100 meter: one hue (#33's first series colour) on a fixed 0-100 track, so bars of
 * different airports compare by length. Square at 0, 4px rounded at the data end (#33 marks).
 */
export function ScoreBar({ value, label, small = false }: { value: number; label: string; small?: boolean }) {
  return (
    <span
      className={small ? "score-bar score-bar--small" : "score-bar"}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span className="score-bar__fill" style={{ width: `${value}%`, background: seriesColor(0) }} />
    </span>
  );
}

/** The final score as #33's KPI tile, with the coverage next to it. */
export function ScoreTiles({ airport }: { airport: RankedAirport }) {
  return (
    <KpiTiles
      spec={{
        type: "kpi",
        items: [
          { label: "Final score", value: formatScore(airport.score), unit: "/ 100" },
          { label: "Coverage", value: formatShare(airport.coverage) },
        ],
      }}
    />
  );
}

/** One category: sub-score bar, contribution, weight, and the evidence; or why it is missing. */
export function CategoryDetail({ cat, showLabel = true }: { cat: Category; showLabel?: boolean }) {
  const computed = isComputed(cat);
  return (
    <div className={computed ? "score-cat" : "score-cat score-cat--missing"} data-testid="score-category">
      {showLabel ? <div className="score-cat__label">{cat.label}</div> : null}
      {computed ? (
        <>
          <div className="score-cat__bar">
            <ScoreBar value={cat.subScore} label={`${cat.label} sub-score`} />
            <span className="score-cat__value">{formatScore(cat.subScore)}</span>
          </div>
          <dl className="score-cat__facts">
            <div>
              <dt>Contribution</dt>
              <dd>{cat.contribution === null ? "—" : `${formatScore(cat.contribution)} pts`}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{formatShare(cat.weight)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="score-cat__missing">{missingText(cat)}</p>
      )}
      {cat.evidence ? (
        <div className="score-cat__evidence">
          {cat.evidence.explanation ? <p className="score-cat__explanation">{cat.evidence.explanation}</p> : null}
          <InternationalFlightsLine evidence={cat.evidence} />
          {computed && cat.evidence.formula ? <code className="score-cat__formula">{cat.evidence.formula}</code> : null}
        </div>
      ) : null}
    </div>
  );
}

/** All four categories of one airport, in the fixed order. */
export function CategoryList({ airport }: { airport: RankedAirport }) {
  return (
    <div className="score-cats">
      {CATEGORIES.map((key) => (
        <CategoryDetail key={key} cat={airport.breakdown[key]} />
      ))}
    </div>
  );
}
