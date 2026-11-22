import "../visuals.css";
import "./score.css";
import { ScoreCompare } from "./ScoreCompare";
import { ScoreReport } from "./ScoreReport";
import { ScoreTable } from "./ScoreTable";
import { MAX_SHOWN, SCALE_TEXT, sortByScore, type ScoreResult } from "./spec";

/** The layout follows the number of airports: 1 is a report, 2 side by side, 3 or more a table. */
function Body({ result }: { result: ScoreResult }) {
  const sorted = sortByScore(result.ranking);
  const [first, second] = sorted;
  if (sorted.length === 1 && first) return <ScoreReport airport={first} />;
  if (sorted.length === 2 && first && second) return <ScoreCompare airports={[first, second]} />;
  const shown = sorted.slice(0, MAX_SHOWN);
  const more = sorted.length - shown.length;
  return (
    <>
      <ScoreTable airports={shown} />
      {more > 0 ? <p className="score-view__more">+{more} more</p> : null}
    </>
  );
}

/** A checked score_airports result, drawn from the data (never from the model's text). */
export function ScoreView({ result }: { result: ScoreResult }) {
  return (
    <div className="score-view" data-testid="score-view">
      <p className="score-view__mode">{SCALE_TEXT}</p>
      <Body result={result} />
      {result.notFound.length > 0 ? (
        <p className="score-view__not-found">Not found: {result.notFound.join(", ")}</p>
      ) : null}
    </div>
  );
}
