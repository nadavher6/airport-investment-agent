/**
 * Airport Investment Intelligence Agent
 *
 * Entry point. For now this just confirms the project runs.
 * Next steps (see README / design doc):
 *   1. Fetch airport + flight data from public APIs  -> src/data/
 *   2. Deterministic scoring/ranking logic           -> src/scoring/
 *   3. AI layer for explanation + conversation       -> src/agent/
 *   4. Chat interface (CLI first, voice as bonus)    -> src/chat/
 */

function main(): void {
  console.log("Airport Investment Intelligence Agent — project scaffold is running ✈️");
  console.log("TypeScript + Node " + process.version);
}

main();
