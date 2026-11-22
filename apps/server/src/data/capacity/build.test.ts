import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { NO_COORDINATES, NO_RUNWAY } from "./assemble.ts";
import { buildCapacity } from "./build.ts";
import { capacityDataset, getCapacity } from "./dataset.ts";
import { runwayKind, splitCsvLine } from "./nasr.ts";

// A small fixture in the NASR CSV layout (only the columns the build reads, plus EFF_DATE). No network.
const FT_PER_DEG_LAT = 20_902_231 * (Math.PI / 180);
const lat = (northFt: number): number => 40 + northFt / FT_PER_DEG_LAT;
const RWY_HEADER = '"EFF_DATE","SITE_TYPE_CODE","ARPT_ID","RWY_ID","RWY_LEN","SURFACE_TYPE_CODE"';
const END_HEADER = '"EFF_DATE","SITE_TYPE_CODE","ARPT_ID","RWY_ID","RWY_END_ID","LAT_DECIMAL","LONG_DECIMAL"';
const rwy = (code: string, id: string, surface: string, len = 9000): string =>
  `"2026/10/29","A","${code}","${id}",${len},"${surface}"`;
// An east-west runway `northFt` north of the reference line: ends at longitude -100.00 and -99.96.
const ends = (code: string, id: string, northFt: number): string[] =>
  id.split("/").map((end, i) => `"2026/10/29","A","${code}","${id}","${end}",${lat(northFt)},${i === 0 ? -100 : -99.96}`);

const rwyRows = [
  rwy("PAR", "09L/27R", "CONC"), // two parallels 1,000 ft apart -> configuration 2
  rwy("PAR", "09R/27L", "ASPH-CONC"),
  rwy("PAR", "H1", "CONC"), // helipad: ignored
  rwy("ONE", "18/36", "ASPH"), // one runway, no coordinates needed -> configuration 1
  rwy("ONE", "09/27", "TURF"), // unpaved next to a paved runway: ignored
  rwy("GRV", "02/20", "GRAVEL"), // only unpaved runways: used
  rwy("NOC", "01/19", "CONC"), // two runways, one without coordinates -> missing
  rwy("NOC", "10/28", "CONC"),
  rwy("WTR", "NE/SW", "WATER"), // water lane only -> missing
  rwy("ZZZ", "09/27", "CONC"), // not one of the airports asked for
  rwy("TRI", "09A/27A", "CONC"), // close pair + two far singles: 3 independent streams, beyond Figure 2-1
  rwy("TRI", "09B/27B", "CONC"),
  rwy("TRI", "09C/27C", "CONC"),
  rwy("TRI", "09D/27D", "CONC"),
  rwy("INT", "09L/27R", "CONC"), // intermediate pair + a far single: not drawn in Figure 2-1
  rwy("INT", "09C/27C", "CONC"),
  rwy("INT", "09R/27L", "CONC"),
];
const endRows = [
  ...ends("PAR", "09L/27R", 1_000),
  ...ends("PAR", "09R/27L", 0),
  ...ends("NOC", "01/19", 0),
  ...ends("TRI", "09A/27A", 0),
  ...ends("TRI", "09B/27B", 1_000),
  ...ends("TRI", "09C/27C", 6_000),
  ...ends("TRI", "09D/27D", 12_000),
  ...ends("INT", "09L/27R", 0),
  ...ends("INT", "09C/27C", 3_000),
  ...ends("INT", "09R/27L", 8_000),
];

const dir = mkdtempSync(join(tmpdir(), "capacity-build-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const paths = { rwy: join(dir, "APT_RWY.csv"), ends: join(dir, "APT_RWY_END.csv"), codes: join(dir, "codes.json"), out: join(dir, "capacity.json") };
writeFileSync(paths.rwy, [RWY_HEADER, ...rwyRows].join("\n"));
writeFileSync(paths.ends, [END_HEADER, ...endRows].join("\n"));
writeFileSync(
  paths.codes,
  JSON.stringify({ airports: { PAR: {}, ONE: {}, GRV: {}, NOC: {}, WTR: {}, MIA: {}, TRI: {}, INT: {}, LGA: {} } }),
);

describe("the capacity build on a fixture (#54)", () => {
  const dataset = buildCapacity(paths);
  const first = readFileSync(paths.out, "utf8");

  it("writes the asked-for airports sorted by code, with the NASR cycle", () => {
    expect(Object.keys(dataset.airports)).toEqual(["GRV", "INT", "LGA", "MIA", "NOC", "ONE", "PAR", "TRI", "WTR"]);
    expect(dataset.meta).toMatchObject({ nasrCycle: "2026-10-29", airportCount: 9, mappedCount: 5 });
    expect(dataset.meta.capacitySources).toEqual({ "faa-capacity-profile": 2, "figure-2-1-extended": 2, "figure-2-1": 3 });
  });

  it("Core 30 airports take the FAA capacity profile, with or without NASR runways in the input", () => {
    // LGA and MIA have no runway rows in the fixture: the published capacity does not depend on the layout.
    expect(dataset.airports.LGA!.capacity).toMatchObject({ source: "faa-capacity-profile", asv: 359_200 });
    expect(dataset.airports.MIA!.capacity).toMatchObject({ source: "faa-capacity-profile", asv: 599_100 });
    expect(dataset.airports.PAR!.capacity).toMatchObject({ source: "figure-2-1", asv: 307_500 });
  });

  it("layouts beyond Figure 2-1 take the extended value, marked as an extension", () => {
    const tri = dataset.airports.TRI!;
    expect(tri.configuration).toMatchObject({ figure21No: 7, asv: 550_000 });
    expect(tri.capacity).toMatchObject({
      source: "figure-2-1-extended",
      asv: 670_000,
      extension: { baseFigure21No: 7, addedPairs: 0, addedSingles: 1 },
    });
    expect(tri.capacity!.basis).toContain("not an FAA figure");
    const int = dataset.airports.INT!;
    expect(int.configuration).toMatchObject({ figure21No: 4, asv: 337_500 });
    expect(int.capacity).toMatchObject({ source: "figure-2-1-extended", asv: 550_000 });
    expect(int.capacity!.basis).toContain("intermediate pair counted as a close pair");
  });

  it("running it twice gives byte-identical output", () => {
    buildCapacity(paths);
    expect(readFileSync(paths.out, "utf8")).toBe(first);
  });

  it("measures parallel spacing from the end coordinates and maps the configuration", () => {
    const par = dataset.airports.PAR!;
    expect(par.runways.map((r) => r.id)).toEqual(["09L/27R", "09R/27L"]); // helipad dropped
    expect(par.parallelSpacingsFt).toEqual([[1_000]]);
    expect(par.configuration).toMatchObject({ figure21No: 2, asv: 307_500 });
    expect(dataset.airports.ONE!.configuration).toMatchObject({ figure21No: 1, asv: 217_500 });
    expect(dataset.airports.ONE!.runways.map((r) => r.id)).toEqual(["18/36"]);
    expect(dataset.airports.GRV!.configuration?.figure21No).toBe(1);
  });

  it("an airport it cannot map is missing, with the reason, never guessed", () => {
    expect(dataset.airports.NOC).toMatchObject({ configuration: null, missingReason: NO_COORDINATES });
    expect(dataset.airports.WTR).toMatchObject({ configuration: null, missingReason: NO_RUNWAY, runways: [] });
    expect(dataset.airports.MIA).toMatchObject({ configuration: null, missingReason: NO_RUNWAY });
    expect(dataset.airports.NOC!.capacity).toBeNull();
    expect(dataset.airports.WTR!.capacity).toBeNull();
  });
});

describe("NASR parsing helpers (#54)", () => {
  it("splits quoted CSV fields", () => {
    expect(splitCsvLine('"a,b","c""d",,7')).toEqual(["a,b", 'c"d', "", "7"]);
  });

  it("classifies runway surfaces", () => {
    expect(runwayKind("09/27", "ASPH-CONC")).toBe("paved");
    expect(runwayKind("09/27", "PEM")).toBe("paved");
    expect(runwayKind("09/27", "TURF-GRVL")).toBe("unpaved");
    expect(runwayKind("H1", "CONC")).toBeNull();
    expect(runwayKind("NE/SW", "WATER")).toBeNull();
    expect(runwayKind("H2", "ROOF-TOP")).toBeNull();
  });
});

describe("the committed data/capacity.json (#54)", () => {
  it("is sorted by code and covers every FAA airport in the scoring population", () => {
    const keys = Object.keys(capacityDataset.airports);
    expect(keys).toEqual([...keys].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
    expect(capacityDataset.meta.airportCount).toBe(keys.length);
  });

  it("spot checks: SAN single, LGA intersecting, ATL four-parallel (configuration 8)", () => {
    expect(getCapacity("san")?.configuration).toMatchObject({ figure21No: 1, asv: 217_500 });
    expect(getCapacity("LGA")).toMatchObject({ crossing: true, configuration: { figure21No: 9, asv: 232_500 } });
    expect(getCapacity("ATL")).toMatchObject({ layoutRunways: 5, configuration: { figure21No: 8, asv: 615_000, runwaysUsed: 4 } });
    expect(getCapacity("ATL")!.parallelSpacingsFt).toEqual([[4210, 1052, 4409, 1003]]);
    expect(getCapacity("ISN")).toMatchObject({ configuration: null }); // closed in 2019: not in NASR
    expect(getCapacity(42)).toBeNull();
  });

  it("ASV source: all 30 Core airports use the FAA capacity profile; others Figure 2-1 or its extension", () => {
    expect(capacityDataset.meta.capacitySources["faa-capacity-profile"]).toBe(30);
    expect(getCapacity("ATL")!.capacity).toMatchObject({ source: "faa-capacity-profile", asv: 949_800 });
    expect(getCapacity("DEN")!.capacity).toMatchObject({ source: "faa-capacity-profile", asv: 1_211_100 });
    expect(getCapacity("SNA")!.capacity).toMatchObject({ source: "figure-2-1", asv: 217_500 });
    expect(getCapacity("CVG")!.capacity).toMatchObject({ source: "figure-2-1-extended", asv: 550_000 });
  });
});
