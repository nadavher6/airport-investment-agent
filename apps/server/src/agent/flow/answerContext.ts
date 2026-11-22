import type { JsonValue } from "@airport/shared";
import { NO_CANDIDATES_PROMPT, SCORE_ANSWER_PROMPT, SCORE_FAILED_PROMPT } from "../prompts/scoreAnswer.ts";
import { COMPARE_SKILL, usesCompareSkill } from "../skills/compare.ts";
import type { ToolRunResult } from "../tools/tool.ts";
import type { Resolution } from "./resolve.ts";

/** What the answer step knows about the tool steps; it goes in the system context, not the dialogue (#25). */
export interface ScoreOutcome {
  readonly resolution: Resolution;
  /** Undefined when no candidate resolved, so score_airports was not called. */
  readonly score?: ToolRunResult<JsonValue>;
}

function notes(resolution: Resolution): string[] {
  const out: string[] = [];
  const { total, codes, namedKept } = resolution;
  if (total > codes.length) {
    // Named airports are kept ahead of the place airports, so "busiest" only describes the place airports.
    const note =
      namedKept === 0
        ? `showing the ${codes.length} busiest of ${total}`
        : `showing the airports you named plus the ${codes.length - namedKept} busiest of the rest`;
    out.push(
      namedKept === 0
        ? `The question matched ${total} airports; only the ${codes.length} busiest (latest enplanements) were scored. Say so in the answer: "${note}".`
        : `The question matched ${total} airports; the airports named in it were kept and the other slots went to the busiest (latest enplanements) of the rest, ${codes.length} scored in all. Say so in the answer: "${note}".`,
    );
  }
  // Model-returned codes are never copied into the system context: only counts.
  if (resolution.unknownCodes.length > 0) {
    out.push(`${resolution.unknownCodes.length} candidate code(s) are not US airports in the data and were dropped. Say so briefly.`);
  }
  if (resolution.failedCodes.length > 0) {
    out.push(`${resolution.failedCodes.length} candidate code(s) could not be looked up (a tool error, not a wrong code) and were not scored. Say so briefly.`);
  }
  return out;
}

/** The answer step's system context: the instructions, then the tool results and the notes about them. */
export function answerSystemContext(outcome: ScoreOutcome): string {
  const extra = notes(outcome.resolution);
  const withNotes = (text: string): string => (extra.length > 0 ? `${text}\n\n## Notes\n${extra.map((n) => `- ${n}`).join("\n")}` : text);
  if (outcome.score === undefined) return withNotes(NO_CANDIDATES_PROMPT);
  if (!outcome.score.ok) return withNotes(`${SCORE_FAILED_PROMPT}\n\nReason: ${outcome.score.error.message}`);
  const output = outcome.score.output;
  // #46: 2–5 scored airports get the compare skill; 1 gets none (the single-airport report applies).
  const compare = usesCompareSkill(scoredCount(output)) ? `\n\n${COMPARE_SKILL}` : "";
  return withNotes(`${SCORE_ANSWER_PROMPT}${compare}\n\n## Tool results (score_airports)\n${JSON.stringify(output)}`);
}

/** How many airports a score_airports output ranks (`ranking.length`; 0 for any other shape). */
function scoredCount(output: JsonValue): number {
  if (typeof output !== "object" || output === null || Array.isArray(output)) return 0;
  const ranking = output.ranking;
  return Array.isArray(ranking) ? ranking.length : 0;
}
