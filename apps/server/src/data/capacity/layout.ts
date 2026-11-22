/**
 * Runway geometry for the capacity build: turn each runway's two end coordinates (NASR APT_RWY_END) into
 * the layout Figure 2-1 distinguishes (asv.ts): groups of parallel runways with their centerline spacing,
 * and whether runways of two groups cross. Pure: no I/O.
 */
import { MIN_PARALLEL_SPACING_FT, type RunwayLayout } from "./asv.ts";

export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** A runway with both ends located (decimal degrees). */
export interface LocatedRunway {
  readonly id: string;
  readonly ends: readonly [LatLon, LatLon];
}

/**
 * Two runways whose headings differ by at most this many degrees are treated as parallel. Parallel runways
 * share a heading (ATL's five run within 0.1 degrees of each other); crossing ones differ by tens of degrees.
 * The build reports the spread it sees; see data/raw/SOURCES.md.
 */
export const PARALLEL_TOLERANCE_DEG = 10;

const EARTH_RADIUS_FT = 20_902_231; // 6,371 km
const RAD = Math.PI / 180;

interface Segment {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  /** Heading of the runway axis in degrees, 0 <= h < 180 (direction-free). */
  readonly heading: number;
}

/** Local flat projection (feet) around a reference point: fine over an airport's few miles. */
function projector(ref: LatLon): (p: LatLon) => [number, number] {
  const cos = Math.cos(ref.lat * RAD);
  return (p) => [(p.lon - ref.lon) * RAD * cos * EARTH_RADIUS_FT, (p.lat - ref.lat) * RAD * EARTH_RADIUS_FT];
}

function toSegments(runways: readonly LocatedRunway[]): Segment[] {
  const all = runways.flatMap((r) => r.ends);
  const ref = { lat: all.reduce((s, p) => s + p.lat, 0) / all.length, lon: all.reduce((s, p) => s + p.lon, 0) / all.length };
  const project = projector(ref);
  return runways.map((r) => {
    const a = project(r.ends[0]);
    const b = project(r.ends[1]);
    const heading = ((Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD) % 180 + 180) % 180;
    return { a, b, heading };
  });
}

/** Smallest angle between two direction-free headings, 0-90 degrees. */
export function headingDifference(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 180;
  return Math.min(d, 180 - d);
}

const cross = (o: readonly [number, number], p: readonly [number, number], q: readonly [number, number]): number =>
  (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);

/** Whether two runway segments touch or cross. */
function intersects(s: Segment, t: Segment): boolean {
  const d1 = cross(t.a, t.b, s.a);
  const d2 = cross(t.a, t.b, s.b);
  const d3 = cross(s.a, s.b, t.a);
  const d4 = cross(s.a, s.b, t.b);
  return ((d1 >= 0 && d2 <= 0) || (d1 <= 0 && d2 >= 0)) && ((d3 >= 0 && d4 <= 0) || (d3 <= 0 && d4 >= 0));
}

/** Connected components of runways whose headings are within the parallel tolerance. */
function parallelComponents(segments: readonly Segment[]): number[][] {
  const parent = segments.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] as number)));
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (headingDifference((segments[i] as Segment).heading, (segments[j] as Segment).heading) <= PARALLEL_TOLERANCE_DEG) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map<number, number[]>();
  segments.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()];
}

/** Centerline offsets (ft) of a parallel group, sorted, with runways under 700 ft apart merged into one. */
function groupOffsets(members: readonly Segment[]): number[] {
  const first = members[0] as Segment;
  // Normal to the group's axis (taken from the first runway; the others are within the tolerance).
  const n: [number, number] = [-Math.sin(first.heading * RAD), Math.cos(first.heading * RAD)];
  const offsets = members
    .map((s) => (((s.a[0] + s.b[0]) / 2) * n[0] + ((s.a[1] + s.b[1]) / 2) * n[1]))
    .sort((x, y) => x - y);
  const merged: number[][] = [];
  for (const o of offsets) {
    const last = merged[merged.length - 1];
    if (last !== undefined && o - (last[last.length - 1] as number) < MIN_PARALLEL_SPACING_FT) last.push(o);
    else merged.push([o]);
  }
  return merged.map((c) => c.reduce((s, x) => s + x, 0) / c.length);
}

export interface LayoutSummary {
  readonly layout: RunwayLayout;
  /** Rounded spacings (ft) between neighbours, per parallel group with 2+ (merged) runways. */
  readonly parallelSpacingsFt: number[][];
  /** Whether runways of two different groups cross; null with a single orientation. */
  readonly crossing: boolean | null;
  /** Largest heading spread inside one parallel group, degrees (for the build report). */
  readonly maxSpreadDeg: number;
}

/** Reduce located runways to the Figure 2-1 layout. Needs at least one runway. */
export function summarizeLayout(runways: readonly LocatedRunway[]): LayoutSummary {
  const segments = toSegments(runways);
  const components = parallelComponents(segments);
  const offsets = components.map((c) => groupOffsets(c.map((i) => segments[i] as Segment)));
  const crossMatrix = components.map((ci) =>
    components.map((cj) => ci.some((i) => cj.some((j) => i !== j && intersects(segments[i] as Segment, segments[j] as Segment)))),
  );
  const maxSpreadDeg = Math.max(
    0,
    ...components.flatMap((c) => c.flatMap((i) => c.map((j) => headingDifference((segments[i] as Segment).heading, (segments[j] as Segment).heading)))),
  );
  return {
    layout: { parallelGroups: offsets, crosses: (i, j) => crossMatrix[i]?.[j] === true },
    parallelSpacingsFt: offsets
      .filter((o) => o.length > 1)
      .map((o) => o.slice(1).map((x, i) => Math.round(x - (o[i] as number)))),
    crossing: components.length > 1 ? crossMatrix.some((row, i) => row.some((v, j) => i !== j && v)) : null,
    maxSpreadDeg: Math.round(maxSpreadDeg * 10) / 10,
  };
}
