import { asModelId } from "@airport/shared";
import { describe, expect, it } from "vitest";
import { testConfig } from "../test/helpers.ts";
import { DEFAULT_MODEL_ID, findModel, listModels } from "./models.ts";

describe("model catalog", () => {
  it("marks every model available when no provider keys are set (mock mode)", () => {
    expect(listModels(testConfig()).every((m) => m.available)).toBe(true);
  });

  it("marks only models of configured providers as available", () => {
    const models = listModels(testConfig(["groq"]));
    for (const model of models) {
      expect(model.available).toBe(model.provider === "groq");
    }
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
