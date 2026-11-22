import { GRADING_SKILL } from "../skills/grading.ts";

/**
 * The system prompt for a `grading` turn (#43): one main-model call that answers questions about
 * the scoring method only from the grading skill. A small editable constant: the owner owns the wording.
 */
export const GRADING_ANSWER_PROMPT = `You explain how this assistant grades US airports for modernization and expansion investment.
Answer ONLY from the grading skill below. If the question is about something the skill does not cover, say plainly that it is not covered, and do not guess.
Keep it short and in plain English. Do not score or rank specific airports here: say the user can ask for that directly.`;

/** The full system context of a grading turn: the prompt, then the skill. */
export const gradingSystemPrompt = (): string => `${GRADING_ANSWER_PROMPT}\n\n${GRADING_SKILL}`;
