import { Router } from "express";
import { API_ROUTES, type HealthResponse } from "@airport/shared";
import type { ServerConfig } from "../config.ts";

export function healthRouter(config: ServerConfig): Router {
  const router = Router();
  router.get(API_ROUTES.health, (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
    };
    res.json(body);
  });
  return router;
}
