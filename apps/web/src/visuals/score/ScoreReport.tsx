import { CategoryList, ScoreTiles } from "./parts";
import type { RankedAirport } from "./spec";

/** One airport, one full report: the final score tile with coverage, then the four categories. */
export function ScoreReport({ airport }: { airport: RankedAirport }) {
  return (
    <article className="score-report" aria-label={`Score report: ${airport.airportCode}`}>
      <header className="score-report__head">
        <span className="score-report__code">{airport.airportCode}</span>
        {airport.name ? <span className="score-report__name">{airport.name}</span> : null}
      </header>
      <ScoreTiles airport={airport} />
      <CategoryList airport={airport} />
    </article>
  );
}
