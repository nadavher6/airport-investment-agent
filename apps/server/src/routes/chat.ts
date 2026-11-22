import { once } from "node:events";
import { Router } from "express";
import { API_ROUTES } from "@airport/shared";
import type { Agent } from "../agent/agent.ts";
import type { ServerConfig } from "../config.ts";
import { findModel } from "../catalog/models.ts";
import { HttpError } from "../http/errors.ts";
import { openEventStream, writeEvent } from "../http/sse.ts";
import { validateChatRequest } from "../http/validateChatRequest.ts";

export function chatRouter(config: ServerConfig, agent: Agent): Router {
  const router = Router();

  router.post(API_ROUTES.chat, async (req, res) => {
    // Everything that can fail with a normal HTTP status happens before the stream opens.
    const request = validateChatRequest(req.body);
    const model = findModel(config, request.modelId);
    if (!model) throw new HttpError("not_found", `Unknown model "${request.modelId}"`);
    if (!model.available) throw new HttpError("model_unavailable", `${model.label} has no API key configured`);

    // Stop the agent when the client goes away (tab closed, Stop pressed).
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    openEventStream(res);
    try {
      const { signal } = controller;
      for await (const event of agent.run({ request, model, signal })) {
        // Don't rely on the agent honouring the signal. Breaking also calls return() on the generator.
        if (signal.aborted) break;
        // Backpressure. Passing the signal makes the wait reject (AbortError) if the client leaves.
        if (!writeEvent(res, event)) await once(res, "drain", { signal });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(err);
        writeEvent(res, { type: "error", error: { code: "internal", message: "The agent failed mid-response" } });
      }
    } finally {
      res.end();
    }
  });

  return router;
}
