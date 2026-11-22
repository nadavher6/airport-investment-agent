/**
 * The fixed answer sent whenever the classifier labels a message `off_topic` (#21). The main LLM is not
 * called for it, so off-topic and prompt-injection messages never reach the model. Same text for every
 * provider; edit it here. Markdown is fine.
 */
export const OFF_TOPIC_ANSWER = `Sorry, I can only help with **U.S. airports and airport investment**: passenger traffic, comparing airports, and expansion or modernization questions.
Try something like *"How has BOS passenger traffic changed since 2019?"*`;
