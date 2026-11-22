import type { JsonValue, MessageId } from "@airport/shared";
import { getTool } from "../tools/registry.ts";
import type { RegisteredTool } from "../tools/tool.ts";
import type { Candidates } from "./candidates.ts";
import { runToolStep, type ToolStep } from "./toolStep.ts";

/** At most this many airports reach score_airports (#42; the owner can change the rule). */
export const MAX_SCORED_AIRPORTS = 5;

/** The lookup tools the resolve step calls, through the Tool contract. */
export interface LookupTools {
  readonly getAirportByCode: RegisteredTool;
  readonly findAirportsByCity: RegisteredTool;
  readonly findAirportsByRegion: RegisteredTool;
}

function registered(name: string): RegisteredTool {
  const tool = getTool(name);
  if (tool === undefined) throw new Error(`The ${name} tool is not in the registry`);
  return tool;
}

/** The merged lookup tools from the TOOLS registry. */
export const registryLookupTools = (): LookupTools => ({
  getAirportByCode: registered("get_airport_by_code"),
  findAirportsByCity: registered("find_airports_by_city"),
  findAirportsByRegion: registered("find_airports_by_region"),
});

interface Resolved {
  readonly code: string;
  readonly latestEnplanements: number;
}

export interface Resolution {
  /** The tool steps run, in order (their events are streamed). */
  readonly steps: readonly ToolStep[];
  /** The codes to score: deduped, at most MAX_SCORED_AIRPORTS. */
  readonly codes: readonly string[];
  /** How many distinct airports the candidates resolved to before the cap. */
  readonly total: number;
  /** Candidate codes that get_airport_by_code answered with not_found (dropped). Never put in the system context: they are model-returned text. */
  readonly unknownCodes: readonly string[];
  /** Candidate codes whose lookup itself failed (tool error): not scored, but not known to be wrong. Same rule: never echoed. */
  readonly failedCodes: readonly string[];
  /** How many of `codes` were named by the user/model (kept ahead of the place airports). */
  readonly namedKept: number;
}

const isObject = (value: JsonValue | undefined): value is { readonly [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An AirportSummary-like object ({ code, latestEnplanements }), or undefined. */
function asAirport(value: JsonValue | undefined): Resolved | undefined {
  if (!isObject(value)) return undefined;
  const { code, latestEnplanements } = value;
  if (typeof code !== "string") return undefined;
  return { code, latestEnplanements: typeof latestEnplanements === "number" ? latestEnplanements : 0 };
}

/** The airports in a find_airports_by_city / find_airports_by_region output (`results[*].airports`). */
function airportsInResults(output: JsonValue): Resolved[] {
  if (!isObject(output) || !isObject(output.results)) return [];
  return Object.values(output.results).flatMap((result) => {
    const airports = isObject(result) ? result.airports : undefined;
    return Array.isArray(airports) ? airports.flatMap((a) => asAirport(a) ?? []) : [];
  });
}

const busiestFirst = (list: readonly Resolved[]): Resolved[] => [...list].sort((a, b) => b.latestEnplanements - a.latestEnplanements);

/**
 * Resolves the candidates deterministically (#42): get_airport_by_code confirms each code (unknown ones are
 * dropped), find_airports_by_city and find_airports_by_region expand the places. Codes are deduped and capped at
 * MAX_SCORED_AIRPORTS: confirmed codes first (the busiest of them if they alone are more than the cap), then the
 * place airports fill the free slots, busiest (latest enplanements) first.
 */
export async function resolveCandidates(
  candidates: Candidates,
  tools: LookupTools,
  messageId: MessageId,
  signal: AbortSignal,
): Promise<Resolution> {
  const steps: ToolStep[] = [];
  const named = new Map<string, Resolved>();
  const places = new Map<string, Resolved>();
  const unknownCodes: string[] = [];
  const failedCodes: string[] = [];

  const codes = [...new Set(candidates.codes.map((c) => c.trim().toUpperCase()))];
  for (const code of codes) {
    const step = await runToolStep(tools.getAirportByCode, { code }, messageId, signal);
    steps.push(step);
    if (!step.result.ok) {
      failedCodes.push(code);
      continue;
    }
    const airport = asAirport(step.result.output);
    if (airport === undefined) unknownCodes.push(code);
    else named.set(airport.code, airport);
  }
  const placeSteps: [RegisteredTool, { readonly [key: string]: JsonValue }][] = [];
  if (candidates.cities.length > 0) placeSteps.push([tools.findAirportsByCity, { cities: [...candidates.cities] }]);
  if (candidates.region !== null) placeSteps.push([tools.findAirportsByRegion, { region: candidates.region }]);
  for (const [tool, input] of placeSteps) {
    const step = await runToolStep(tool, input, messageId, signal);
    steps.push(step);
    if (!step.result.ok) continue;
    for (const airport of airportsInResults(step.result.output)) {
      if (!named.has(airport.code)) places.set(airport.code, airport);
    }
  }

  const keptNamed = named.size > MAX_SCORED_AIRPORTS ? busiestFirst([...named.values()]).slice(0, MAX_SCORED_AIRPORTS) : [...named.values()];
  const keptPlaces = busiestFirst([...places.values()]).slice(0, MAX_SCORED_AIRPORTS - keptNamed.length);
  return {
    steps,
    codes: [...keptNamed, ...keptPlaces].map((a) => a.code),
    total: named.size + places.size,
    unknownCodes,
    failedCodes,
    namedKept: keptNamed.length,
  };
}
