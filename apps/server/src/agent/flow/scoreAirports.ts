import { getTool } from "../tools/registry.ts";
import type { RegisteredTool } from "../tools/tool.ts";

/**
 * score_airports for the agent flow (#42), behind the #30 Tool contract: the flow only needs a
 * `RegisteredTool` named "score_airports" that takes `{ airport_codes: string[] }` and returns
 * #38's `{ mode, ranking, notFound }`. The agent takes it as an injectable dependency
 * (`AgentOptions.scoreAirports`); tests pass a fake (`src/test/fakeScoreAirports.ts`).
 */
export type ScoreAirportsTool = RegisteredTool;

export const SCORE_AIRPORTS_TOOL_NAME = "score_airports";

/** The real score_airports (PR #38), from the TOOLS registry. A missing tool is a programming error. */
export function defaultScoreAirportsTool(): ScoreAirportsTool {
  const tool = getTool(SCORE_AIRPORTS_TOOL_NAME);
  if (tool === undefined) throw new Error(`The ${SCORE_AIRPORTS_TOOL_NAME} tool is not in the registry`);
  return tool;
}
