import { describe, expect, it } from "vitest";
import { CLASSIFIER_EXAMPLES } from "../classifier/examples.ts";
import { OFF_TOPIC_INTRO, OFF_TOPIC_SUGGESTIONS, offTopicAnswer, pick } from "./offTopic.ts";

describe("the off_topic suggestions (#44)", () => {
  it("has exactly 15 entries, each non-empty and unique", () => {
    expect(OFF_TOPIC_SUGGESTIONS).toHaveLength(15);
    expect(OFF_TOPIC_SUGGESTIONS.every((s) => s.trim().length > 0)).toBe(true);
    expect(new Set(OFF_TOPIC_SUGGESTIONS).size).toBe(15);
  });

  it("with a fake rng returning index i, the reply contains suggestion i (all 15 reachable)", () => {
    const seen = new Set<string>();
    OFF_TOPIC_SUGGESTIONS.forEach((suggestion, i) => {
      const answer = offTopicAnswer(() => i / OFF_TOPIC_SUGGESTIONS.length);
      expect(answer).toBe(`${OFF_TOPIC_INTRO}\nTry something like *"${suggestion}"*`);
      seen.add(suggestion);
    });
    expect(seen.size).toBe(15);
  });

  it("pick clamps the rng's edges to the list", () => {
    expect(pick(["a", "b", "c"], () => 0)).toBe("a");
    expect(pick(["a", "b", "c"], () => 0.999999)).toBe("c");
    expect(pick(["a", "b", "c"], () => 1)).toBe("c");
    expect(() => pick([], () => 0)).toThrow();
  });

  it("every suggestion is a labelled classifier example that is in_scope or grading, never refused", () => {
    for (const suggestion of OFF_TOPIC_SUGGESTIONS) {
      const example = CLASSIFIER_EXAMPLES.find((e) => e.message === suggestion);
      expect(example?.expected, suggestion).toMatch(/^(in_scope|grading)$/);
    }
  });
});
