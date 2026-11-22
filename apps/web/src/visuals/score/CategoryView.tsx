import "../visuals.css";
import "./score.css";
import { Fragment, useId, useState } from "react";
import { CompareGrid, type GridRow } from "../compare/Compare";
import { KpiTiles } from "../KpiTiles";
import { InternationalFlightsLine, ScoreBar } from "./parts";
import { MAX_SHOWN, MODE_TEXT, formatIntlFlights, formatScore, formatShare, internationalFlights, missingText } from "./spec";
import { GrowthView } from "./GrowthView";
import {
  asCategory,
  growthAirports,
  formatRaw,
  isScored,
  sortBySubScore,
  type CategoryAirport,
  type CategoryResult,
} from "./categorySpec";

const airportTitle = (a: CategoryAirport): string => (a.name ? `${a.airportCode} · ${a.name}` : a.airportCode);

/** The sub-score as the score view's 0-100 bar with its number; or why it is missing. */
function SubScore({ result, airport }: { result: CategoryResult; airport: CategoryAirport }) {
  if (!isScored(airport)) return <p className="score-cat__missing">{missingText(asCategory(result, airport))}</p>;
  return (
    <div className="score-cat__bar">
      <ScoreBar value={airport.subScore} label={`${airport.airportCode} ${result.label} sub-score`} />
      <span className="score-cat__value">{formatScore(airport.subScore)}</span>
    </div>
  );
}

/** The explanation and, when computed, the formula: the "show your work" of one airport. */
function Evidence({ airport }: { airport: CategoryAirport }) {
  const ev = airport.evidence;
  if (!ev) return null;
  return (
    <div className="score-cat__evidence">
      {ev.explanation ? <p className="score-cat__explanation">{ev.explanation}</p> : null}
      <InternationalFlightsLine evidence={ev} />
      {isScored(airport) && ev.formula ? <code className="score-cat__formula">{ev.formula}</code> : null}
    </div>
  );
}

/** 1 airport: a card with the raw value and sub-score tiles, the sub-score bar, the explanation and the formula. */
function CategoryCard({ result, airport }: { result: CategoryResult; airport: CategoryAirport }) {
  return (
    <article className="score-report" aria-label={`${result.label}: ${airport.airportCode}`}>
      <header className="score-report__head">
        <span className="score-report__code">{airport.airportCode}</span>
        {airport.name ? <span className="score-report__name">{airport.name}</span> : null}
      </header>
      {isScored(airport) ? (
        <KpiTiles
          spec={{
            type: "kpi",
            items: [
              { label: "Raw value", value: formatRaw(airport.raw, result.unit) },
              { label: "Sub-score", value: formatScore(airport.subScore), unit: "/ 100" },
            ],
          }}
        />
      ) : null}
      <div className="score-cat" data-testid="category-airport">
        <SubScore result={result} airport={airport} />
        <Evidence airport={airport} />
      </div>
    </article>
  );
}

/** 2 airports: #39's compare grid, one row each for the raw value, the sub-score and the evidence. */
function CategoryCompare({ result, airports }: { result: CategoryResult; airports: readonly [CategoryAirport, CategoryAirport] }) {
  const rows: GridRow[] = [
    { label: "Raw value", cells: airports.map((a, i) => <span key={i} className="score-cell__value">{formatRaw(a.raw, result.unit)}</span>) },
    { label: "Sub-score", cells: airports.map((a, i) => <SubScore key={i} result={result} airport={a} />) },
    ...(hasIntlColumn(result)
      ? [{ label: "International flights", cells: airports.map((a, i) => <span key={i} className="score-cell__value" data-testid="intl-flights-cell">{intlFlightsText(a)}</span>) }]
      : []),
    { label: "Evidence", cells: airports.map((a, i) => <Evidence key={i} airport={a} />) },
  ];
  return (
    <div className="score-compare">
      <CompareGrid columns={airports.map(airportTitle)} rows={rows} title={result.label} />
    </div>
  );
}

/** The long-haul category gets an "Int'l flights" column (#74). */
const hasIntlColumn = (result: CategoryResult): boolean => result.category === "long_haul";

/** The number of international flights of one airport as a table cell: "61,715 of 266,820 departures", or "—". */
const intlFlightsText = (airport: CategoryAirport): string => {
  const f = internationalFlights(airport.evidence);
  return f === null ? "—" : formatIntlFlights(f);
};

function Row({ result, airport, rank }: { result: CategoryResult; airport: CategoryAirport; rank: number }) {
  const [open, setOpen] = useState(false);
  const detailId = useId();
  return (
    <Fragment>
      <tr className={open ? "score-table__row is-open" : "score-table__row"} data-testid="category-row">
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
        <td className="viz-num">{formatRaw(airport.raw, result.unit)}</td>
        <td className="viz-num">
          {isScored(airport) ? (
            <span className="score-cell">
              <span className="score-cell__value">{formatScore(airport.subScore)}</span>
              <ScoreBar value={airport.subScore} label={`${airport.airportCode} ${result.label} sub-score`} small />
            </span>
          ) : (
            <span className="score-cell__missing" title="Not computed">
              —
            </span>
          )}
        </td>
        {hasIntlColumn(result) ? (
          <td className="viz-num" data-testid="intl-flights-cell">
            {intlFlightsText(airport)}
          </td>
        ) : null}
      </tr>
      <tr id={detailId} className="score-table__detail" hidden={!open}>
        <td colSpan={hasIntlColumn(result) ? 6 : 5}>
          {isScored(airport) ? null : <SubScore result={result} airport={airport} />}
          <Evidence airport={airport} />
        </td>
      </tr>
    </Fragment>
  );
}

/** 3-5 airports: a table sorted by sub-score (missing last); a row opens its evidence. */
function CategoryTable({ result, airports }: { result: CategoryResult; airports: readonly CategoryAirport[] }) {
  const heads = ["Rank", "Code", "Name", "Raw value", "Sub-score", ...(hasIntlColumn(result) ? ["Int'l flights"] : [])];
  const numeric = (i: number) => i === 0 || i >= 3;
  return (
    <figure className="viz viz--table score-table">
      <div className="viz-table__scroll">
        <table className="viz-table" aria-label={`Airports by ${result.label} sub-score`}>
          <thead>
            <tr>
              {heads.map((h, i) => (
                <th key={h} scope="col" className={numeric(i) ? "viz-num" : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {airports.map((a, i) => (
              <Row key={i} result={result} airport={a} rank={i + 1} />
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** The layout follows the number of airports: 1 is a card, 2 side by side, 3 or more a table. */
function Body({ result }: { result: CategoryResult }) {
  const [first, second] = result.airports;
  if (result.airports.length === 1 && first) return <CategoryCard result={result} airport={first} />;
  if (result.airports.length === 2 && first && second) return <CategoryCompare result={result} airports={[first, second]} />;
  const sorted = sortBySubScore(result.airports);
  const shown = sorted.slice(0, MAX_SHOWN);
  const more = sorted.length - shown.length;
  return (
    <>
      <CategoryTable result={result} airports={shown} />
      {more > 0 ? <p className="score-view__more">+{more} more</p> : null}
    </>
  );
}

/** A checked per-category tool result (#61): only that one category, drawn from the data. */
export function CategoryView({ result }: { result: CategoryResult }) {
  // get_growth with its yearly series (#67) draws the time chart and KPI rows instead of the card / table.
  const growth = growthAirports(result);
  return (
    <div className="score-view" data-testid="category-view">
      <p className="score-view__mode">
        {result.label} · {formatShare(result.weight)} of the final score · {MODE_TEXT[result.mode]}
      </p>
      {growth ? <GrowthView result={result} airports={growth} /> : <Body result={result} />}
      {result.note ? <p className="score-view__not-found">Caveat: {result.note}</p> : null}
      {result.notFound.length > 0 ? <p className="score-view__not-found">Not found: {result.notFound.join(", ")}</p> : null}
    </div>
  );
}
