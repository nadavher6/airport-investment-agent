import { Router } from "express";
import { API_ROUTES, type ModelsResponse } from "@airport/shared";
import type { ServerConfig } from "../config.ts";
import { DEFAULT_MODEL_ID, listModels } from "../catalog/models.ts";

export function modelsRouter(config: ServerConfig): Router {
  const router = Router();
  router.get(API_ROUTES.models, (_req, res) => {
    const body: ModelsResponse = { models: listModels(config), defaultModelId: DEFAULT_MODEL_ID };
    res.json(body);
  });
  return router;
}
