// Place resolvers: airport by code, airports by city/metro name, airports by region. In-memory, no network.
// Airport facts come from the FAA dataset (../enplanements); the metro and region groupings are the
// curated files described in data/SOURCES.md. Nothing here invents a code.
import { enplanementsDataset, findAirport } from "../enplanements/dataset.ts";
import type { AirportRecord, HubType } from "../enplanements/types.ts";
import { metrosFile, regionsFile } from "./files.ts";
import { isCloseMatch, normalizePlace } from "./text.ts";

export interface AirportSummary {
  readonly code: string;
  readonly name: string;
  readonly city: string;
  readonly state: string;
  readonly hubType: HubType | null;
  readonly latestEnplanements: number;
}

export interface CityAirport extends AirportSummary {
  readonly secondary: boolean;
}

export interface NotFound {
  readonly error: "not_found";
}

export interface CityMatch {
  /** "metro": the curated metro list; "city": the dataset's own city text (fallback). */
  readonly matchedAs: "metro" | "city";
  readonly airports: readonly CityAirport[];
}

export interface CityNoMatch {
  readonly airports: readonly [];
  readonly reason: "no_match";
  readonly suggestions?: readonly string[];
}

export type CityResult = CityMatch | CityNoMatch;

export interface CitiesResult {
  /** Keyed by the name exactly as the caller gave it. */
  readonly results: Readonly<Record<string, CityResult>>;
}

export interface RegionResult {
  readonly region: string;
  readonly matchedAs?: "region";
  readonly cities: readonly string[];
  readonly results: Readonly<Record<string, CityResult>>;
  readonly reason?: "no_match";
  readonly suggestions?: readonly string[];
}

function summarize(record: AirportRecord): AirportSummary {
  return {
    code: record.airportCode,
    name: record.name,
    city: record.city,
    state: record.state,
    hubType: record.hubType,
    latestEnplanements: record.latest.enplanements,
  };
}

/** Airports sorted by latest enplanements, highest first (ties by code, so the order is stable). */
function sortAirports(list: readonly CityAirport[]): CityAirport[] {
  return [...list].sort((a, b) => b.latestEnplanements - a.latestEnplanements || a.code.localeCompare(b.code));
}

/** Airport summary by FAA/IATA code (trimmed, uppercased), or { error: "not_found" }. `code` may be LLM output, so any type. */
export function getAirportByCode(code: unknown): AirportSummary | NotFound {
  if (typeof code !== "string") return { error: "not_found" };
  const record = findAirport(code);
  return record === null ? { error: "not_found" } : summarize(record);
}

// Lookup tables, built once at load: normalized text -> metro name, or -> dataset airports.
const metroByText = new Map<string, string>();
for (const [name, metro] of Object.entries(metrosFile.metros)) {
  for (const text of [name, ...metro.aliases]) {
    const key = normalizePlace(text);
    metroByText.set(key, name);
  }
}

const airportsByDatasetCity = new Map<string, AirportRecord[]>();
for (const record of Object.values(enplanementsDataset.airports)) {
  const key = normalizePlace(record.city);
  if (key === "") continue;
  airportsByDatasetCity.set(key, [...(airportsByDatasetCity.get(key) ?? []), record]);
}

function suggest(key: string, candidates: Iterable<[string, string]>): string[] {
  const found = new Set<string>();
  for (const [text, display] of candidates) if (isCloseMatch(key, text)) found.add(display);
  return [...found].sort();
}

function resolveCity(query: string): CityResult {
  const key = normalizePlace(query);
  const metroName = metroByText.get(key);
  if (metroName !== undefined) {
    const airports: CityAirport[] = [];
    for (const entry of metrosFile.metros[metroName]?.airports ?? []) {
      const record = findAirport(entry.code);
      if (record !== null) airports.push({ ...summarize(record), secondary: entry.secondary });
    }
    return { matchedAs: "metro", airports: sortAirports(airports) };
  }
  const datasetHits = airportsByDatasetCity.get(key);
  if (key !== "" && datasetHits !== undefined) {
    return { matchedAs: "city", airports: sortAirports(datasetHits.map((r) => ({ ...summarize(r), secondary: false }))) };
  }
  const candidates: [string, string][] = [...metroByText];
  for (const [text, records] of airportsByDatasetCity) {
    const first = records[0];
    if (first !== undefined) candidates.push([text, first.city]);
  }
  const suggestions = key === "" ? [] : suggest(key, candidates);
  return suggestions.length > 0
    ? { airports: [], reason: "no_match", suggestions }
    : { airports: [], reason: "no_match" };
}

/** Airports for each name in the list: curated metro first, then the dataset's city text; close names are suggested, never swapped in. */
export function findAirportsByCity(cities: unknown): CitiesResult {
  const results: Record<string, CityResult> = {};
  if (!Array.isArray(cities)) return { results };
  for (const city of cities as unknown[]) {
    if (typeof city === "string" && !Object.hasOwn(results, city)) results[city] = resolveCity(city);
  }
  return { results };
}

const regionByText = new Map<string, string>();
for (const [name, region] of Object.entries(regionsFile.regions)) {
  for (const text of [name, ...region.aliases]) regionByText.set(normalizePlace(text), name);
}

/** Resolves an informal region to its city list, then runs the city lookup on that list. */
export function findAirportsByRegion(region: unknown): RegionResult {
  const asked = typeof region === "string" ? region : "";
  const key = normalizePlace(asked);
  const regionName = regionByText.get(key);
  const entry = regionName === undefined ? undefined : regionsFile.regions[regionName];
  if (regionName === undefined || entry === undefined) {
    const suggestions = key === "" ? [] : suggest(key, regionByText);
    return suggestions.length > 0
      ? { region: asked, cities: [], results: {}, reason: "no_match", suggestions }
      : { region: asked, cities: [], results: {}, reason: "no_match" };
  }
  const cities = [...entry.cities];
  return { region: regionName, matchedAs: "region", cities, results: findAirportsByCity(cities).results };
}
