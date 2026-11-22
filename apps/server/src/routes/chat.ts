import { once } from "node:events";
import { Router } from "express";
import { API_ROUTES, type AgentEvent } from "@airport/shared";
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
    if (!model.available) {
      const why = model.provider === "claude-headless" ? "is unavailable: the claude binary was not found" : "has no API key configured";
      throw new HttpError("model_unavailable", `${model.label} ${why}`);
    }

    // Stop the agent when the client goes away (tab closed, Stop pressed).
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    const { signal } = controller;
    const events = agent.run({ request, model, signal })[Symbol.asyncIterator]();
    // Pull the first event before opening the stream, so an agent that fails to start (binary missing,
    // not logged in) throws an HttpError that becomes a normal 4xx/5xx response.
    let first: IteratorResult<AgentEvent>;
    try {
      first = await events.next();
    } catch (err) {
      if (!signal.aborted) throw err;
      first = { done: true, value: undefined };
    }
    if (signal.aborted) {
      await events.return?.();
      res.end();
      return;
    }

    openEventStream(res);
    try {
      for (let step = first; !step.done; step = await events.next()) {
        // Don't rely on the agent honouring the signal. return() stops the generator (and its child process).
        if (signal.aborted) break;
        // Backpressure. Passing the signal makes the wait reject (AbortError) if the client leaves.
        if (!writeEvent(res, step.value)) await once(res, "drain", { signal });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(err);
        writeEvent(res, { type: "error", error: { code: "internal", message: "The agent failed mid-response" } });
      }
    } finally {
      await events.return?.();
      res.end();
    }
  });

  return router;
}
