import { asModelId } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { fakeClaude, type FakeClaude } from "../test/fakeClaude.ts";
import { testConfig } from "../test/helpers.ts";
import { DEFAULT_MODEL_ID, findModel, listModels } from "./models.ts";

describe("model catalog", () => {
  it("marks every API-key model available when no provider keys are set (mock mode)", () => {
    const models = listModels(testConfig()).filter((m) => m.provider !== "claude-headless");
    expect(models.every((m) => m.available)).toBe(true);
  });

  it("marks only models of configured providers as available", () => {
    const models = listModels(testConfig(["groq"])).filter((m) => m.provider !== "claude-headless");
    for (const model of models) {
      expect(model.available).toBe(model.provider === "groq");
    }
  });

  describe("Claude (headless session)", () => {
    let fake: FakeClaude | undefined;
    afterEach(() => fake?.cleanup());
    const claudeOf = (config: ReturnType<typeof testConfig>) => findModel(config, asModelId("claude-headless"));

    it("is listed with thinking and tool chips", () => {
      expect(claudeOf(testConfig())).toMatchObject({
        label: "Claude (headless session)",
        provider: "claude-headless",
        capabilities: { thinking: true, toolUse: true },
      });
    });

    it("is available only when the claude binary is found, whatever API keys are set", () => {
      expect(claudeOf(testConfig())?.available).toBe(false);
      fake = fakeClaude();
      expect(claudeOf(testConfig(["groq"], { searchPath: fake.dir }))?.available).toBe(true);
      expect(claudeOf(testConfig([], { bin: fake.bin }))?.available).toBe(true);
    });
  });

  it("has unique ids and the default is in the list", () => {
    const ids = listModels(testConfig()).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_MODEL_ID);
  });

  it("finds models by id", () => {
    expect(findModel(testConfig(), DEFAULT_MODEL_ID)?.id).toBe(DEFAULT_MODEL_ID);
    expect(findModel(testConfig(), asModelId("nope"))).toBeUndefined();
  });
});
