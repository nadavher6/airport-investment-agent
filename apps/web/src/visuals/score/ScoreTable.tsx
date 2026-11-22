import { Fragment, useId, useState } from "react";
import { CategoryList, ScoreBar, categoryLabel, isComputed } from "./parts";
import { CATEGORIES, formatScore, formatShare, type RankedAirport } from "./spec";

/** A number with a small 0-100 bar under it, for the score columns. */
function ScoreCell({ value, label }: { value: number; label: string }) {
  return (
    <span className="score-cell">
      <span className="score-cell__value">{formatScore(value)}</span>
      <ScoreBar value={value} label={label} small />
    </span>
  );
}

function Row({ airport, rank, columns }: { airport: RankedAirport; rank: number; columns: number }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <Fragment>
      <tr className={open ? "score-table__row is-open" : "score-table__row"} data-testid="score-row">
        <td className="viz-num">{rank}</td>
        <td>
          <button
            type="button"
            className="score-table__toggle"
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`${airport.airportCode} evidence`}
            onClick={() => setOpen(!open)}
          >
            <span className="score-table__chevron" aria-hidden="true">
              ▸
            </span>
            {airport.airportCode}
          </button>
        </td>
        <td>{airport.name}</td>
        <td className="viz-num">
          <ScoreCell value={airport.score} label={`${airport.airportCode} final score`} />
        </td>
        <td className="viz-num">{formatShare(airport.coverage)}</td>
        {CATEGORIES.map((key) => {
          const cat = airport.breakdown[key];
          return (
            <td key={key} className="viz-num">
              {isComputed(cat) ? (
                <ScoreCell value={cat.subScore} label={`${airport.airportCode} ${cat.label}`} />
              ) : (
                <span className="score-cell__missing" title="Not computed">
                  —
                </span>
              )}
            </td>
          );
        })}
      </tr>
      <tr id={detailId} className="score-table__detail" hidden={!open}>
        <td colSpan={columns}>
          <CategoryList airport={airport} />
        </td>
      </tr>
    </Fragment>
  );
}

/** 3-5 airports: one row each, highest final score first (the caller sorts); a row opens its evidence. */
export function ScoreTable({ airports }: { airports: readonly RankedAirport[] }) {
  const heads = ["Rank", "Code", "Name", "Final score", "Coverage", ...CATEGORIES.map((k) => categoryLabel(airports[0], k))];
  const numeric = (i: number) => i === 0 || i >= 3;
  return (
    <figure className="viz viz--table score-table">
      <div className="viz-table__scroll">
        <table className="viz-table" aria-label="Airports by final score">
          <thead>
            <tr>
              {heads.map((h, i) => (
                <th key={i} scope="col" className={numeric(i) ? "viz-num" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {airports.map((a, i) => (
              <Row key={i} airport={a} rank={i + 1} columns={heads.length} />
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
