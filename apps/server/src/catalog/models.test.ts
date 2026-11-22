import { asModelId } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { afterEach } from "vitest";
import { fakeClaude, type FakeClaude } from "../test/fakeClaude.ts";
import { testConfig } from "../test/helpers.ts";
import { DEFAULT_MODEL_ID, findModel, listModels } from "./models.ts";

describe("model catalog", () => {
  it("lists only Gemini and Claude headless, Gemini first (the default)", () => {
    expect(listModels(testConfig()).map((m) => [m.id, m.provider])).toEqual([
      ["gemini-3.8-flash", "gemini"],
      ["claude-headless", "claude-headless"],
    ]);
    expect(DEFAULT_MODEL_ID).toBe("gemini-3.8-flash");
  });

  it("marks Gemini available only when GEMINI_API_KEY is set, and never exposes the key", () => {
    const gemini = (config: ReturnType<typeof testConfig>) => findModel(config, asModelId("gemini-3.8-flash"));
    expect(gemini(testConfig())?.available).toBe(false);
    const config = testConfig(["gemini"]);
    expect(gemini(config)?.available).toBe(true);
    expect(JSON.stringify(listModels(config))).not.toContain(config.gemini.apiKey);
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
      expect(claudeOf(testConfig(["gemini"], { searchPath: fake.dir }))?.available).toBe(true);
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
