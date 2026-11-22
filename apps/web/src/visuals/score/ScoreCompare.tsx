import { CompareGrid, type GridRow } from "../compare/Compare";
import { CategoryDetail, ScoreTiles, categoryLabel } from "./parts";
import { CATEGORIES, type RankedAirport } from "./spec";

/**
 * Two airports side by side in #39's borderless compare grid: the final score first,
 * then one row per category, so the same category of both airports sits on one line.
 */
export function ScoreCompare({ airports }: { airports: readonly [RankedAirport, RankedAirport] }) {
  const columns = airports.map((a) => (a.name ? `${a.airportCode} · ${a.name}` : a.airportCode));
  const rows: GridRow[] = [
    { label: "Final score", cells: airports.map((a, i) => <ScoreTiles key={i} airport={a} />) },
    ...CATEGORIES.map((key) => ({
      label: categoryLabel(airports[0], key),
      cells: airports.map((a, i) => <CategoryDetail key={i} cat={a.breakdown[key]} showLabel={false} />),
    })),
  ];
  return (
    <div className="score-compare">
      <CompareGrid columns={columns} rows={rows} />
    </div>
  );
}
