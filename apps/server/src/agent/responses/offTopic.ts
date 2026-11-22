/**
 * The answer sent whenever the classifier labels a message `off_topic` (#21). The main LLM is not
 * called for it, so off-topic and prompt-injection messages never reach the model. Same text for every
 * provider; edit it here. Markdown is fine. Only the suggested question changes: it is picked at random
 * from OFF_TOPIC_SUGGESTIONS for each reply (#44).
 */
export const OFF_TOPIC_INTRO =
  "Sorry, I can only help with **U.S. airports and airport investment**: passenger traffic, comparing airports, and expansion or modernization questions.";

/** The example questions the off_topic answer suggests, one at random per reply (#44). The owner can edit the list. */
export const OFF_TOPIC_SUGGESTIONS: readonly string[] = [
  "How has BOS passenger traffic changed since 2019?",
  "Compare LAX and SNA.",
  "Which New England airports are strong candidates for terminal expansion?",
  "What are the busiest airports on the West Coast?",
  "How fast is DEN growing?",
  "Compare JFK, EWR and LGA.",
  "Which airports in Texas have grown the most since 2019?",
  "Is SFO back to its pre-COVID passenger levels?",
  "What airports serve the Bay Area?",
  "Rank the top 5 airports in the Southeast for investment.",
  "How many passengers did ATL have in 2024?",
  "What is the long-haul share at ANC?",
  "Which Midwest airports look like good modernization candidates?",
  "Compare SEA and PDX passenger growth.",
  "What does unmet demand mean, and how do you measure it?",
];

/** A random source in [0, 1), like Math.random. Injectable so tests are deterministic. */
export type Rng = () => number;

/** One item of a non-empty list, chosen with `rng`. */
export function pick<T>(list: readonly T[], rng: Rng = Math.random): T {
  const index = Math.min(list.length - 1, Math.max(0, Math.floor(rng() * list.length)));
  const item = list[index];
  if (item === undefined) throw new Error("pick: the list is empty");
  return item;
}

/** The full off_topic answer: the fixed intro, then one suggested question. */
export function offTopicAnswer(rng: Rng = Math.random): string {
  return `${OFF_TOPIC_INTRO}\nTry something like *"${pick(OFF_TOPIC_SUGGESTIONS, rng)}"*`;
}
