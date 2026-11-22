import { z } from "zod";
import { defineTool, fail, ok, type ToolRunResult } from "../agent/tools/tool.ts";
import { SCORE_AIRPORTS_TOOL_NAME, type ScoreAirportsTool } from "../agent/flow/scoreAirports.ts";

/** A recording fake score_airports, in #38's output shape. For tests only: no real scoring. */
export interface FakeScoreAirports {
  readonly tool: ScoreAirportsTool;
  /** The airport_codes of every call, in order. */
  readonly calls: string[][];
}

const inputSchema = z.object({ airport_codes: z.array(z.string().trim().min(1)).min(1) }).strict();

/**
 * Scores the codes 90, 80, 70, ... in input order, with one category each.
 * `failWith` makes every call fail with that message instead.
 */
export function fakeScoreAirports(failWith?: string): FakeScoreAirports {
  const calls: string[][] = [];
  const tool = defineTool({
    name: SCORE_AIRPORTS_TOOL_NAME,
    description: "FAKE score_airports for tests.",
    inputSchema,
    exampleInput: { airport_codes: ["LAX", "SFO"] },
    run: (input): Promise<ToolRunResult<unknown>> => {
      calls.push([...input.airport_codes]);
      if (failWith !== undefined) return Promise.resolve(fail("unavailable", failWith));
      return Promise.resolve(
        ok({
          ranking: input.airport_codes.map((airportCode, i) => ({
            airportCode,
            name: `${airportCode} airport`,
            score: 90 - 10 * i,
            coverage: 1,
            missing: [],
            breakdown: { growth: { label: "Growth / durability", weight: 0.2, available: true, subScore: 50, contribution: 10 } },
          })),
          notFound: [],
        }),
      );
    },
  });
  return { tool, calls };
}
