import { API_ROUTES, asMessageId, asModelId, type AgentEvent } from "@airport/shared";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Agent } from "./agent/agent.ts";
import { createApp } from "./app.ts";
import { DEFAULT_MODEL_ID } from "./catalog/models.ts";
import { disconnectAfterFirstFrame, parseSse, scriptedAgent, startServer, testConfig } from "./test/helpers.ts";

const messageId = asMessageId("msg-1");
const script: AgentEvent[] = [
  { type: "message_start", messageId, modelId: DEFAULT_MODEL_ID },
  { type: "text_delta", messageId, delta: "Hello" },
  { type: "message_end", messageId, stopReason: "end_turn" },
];
const chatBody = { modelId: DEFAULT_MODEL_ID, messages: [{ role: "user", content: "Hi" }] };

const appWith = (agent: Agent = scriptedAgent(script), config = testConfig()) => createApp({ config, agent });

describe("GET /api/health", () => {
  it("reports ok with version and uptime", async () => {
    const res = await request(appWith()).get(API_ROUTES.health).expect(200);
    expect(res.body).toMatchObject({ status: "ok", version: "test" });
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });
});

describe("GET /api/models", () => {
  it("returns the catalog and a default that is in it", async () => {
    const res = await request(appWith()).get(API_ROUTES.models).expect(200);
    expect(res.body.models.length).toBeGreaterThan(0);
    expect(res.body.models.map((m: { id: string }) => m.id)).toContain(res.body.defaultModelId);
  });
});

describe("POST /api/chat", () => {
  it("streams the agent's events as SSE frames, in order", async () => {
    const res = await request(appWith()).post(API_ROUTES.chat).send(chatBody).expect(200);
    expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(res.headers["cache-control"]).toMatch(/no-cache/);
    expect(parseSse(res.text)).toEqual(script);
  });

  it("returns 400 with an ApiErrorBody for an invalid body", async () => {
    const res = await request(appWith()).post(API_ROUTES.chat).send({ modelId: "x", messages: [] }).expect(400);
    expect(res.body).toEqual({ error: { code: "bad_request", message: "messages must be a non-empty array" } });
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(appWith())
      .post(API_ROUTES.chat)
      .set("Content-Type", "application/json")
      .send("{oops")
      .expect(400);
    expect(res.body.error).toEqual({ code: "bad_request", message: "Request body is not valid JSON" });
  });

  it("returns 404 for an unknown model", async () => {
    const res = await request(appWith())
      .post(API_ROUTES.chat)
      .send({ ...chatBody, modelId: "nope" })
      .expect(404);
    expect(res.body.error.code).toBe("not_found");
  });

  it("returns 503 when the model's provider has no API key", async () => {
    // Only groq is configured, so the default (gemini) model is unavailable.
    const res = await request(appWith(scriptedAgent(script), testConfig(["groq"])))
      .post(API_ROUTES.chat)
      .send(chatBody)
      .expect(503);
    expect(res.body.error.code).toBe("model_unavailable");
  });

  it("ends the stream with an error event when the agent throws mid-response", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appWith(scriptedAgent(script.slice(0, 2), true)))
      .post(API_ROUTES.chat)
      .send(chatBody)
      .expect(200);
    const events = parseSse(res.text);
    expect(events.slice(0, 2)).toEqual(script.slice(0, 2));
    expect(events.at(-1)).toEqual({
      type: "error",
      error: { code: "internal", message: "The agent failed mid-response" },
    });
    expect(log).toHaveBeenCalledOnce();
  });

  it("aborts the agent run when the client disconnects, without logging an error", { timeout: 2000 }, async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    let resolveFinished!: () => void;
    const agentFinished = new Promise<void>((resolve) => (resolveFinished = resolve));
    // Like a real provider: the pending request rejects with the abort reason.
    const abortableAgent: Agent = {
      async *run({ signal }) {
        try {
          yield { type: "message_start", messageId, modelId: asModelId("m") };
          await new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
        } finally {
          resolveFinished();
        }
      },
    };

    const server = await startServer(appWith(abortableAgent));
    try {
      await disconnectAfterFirstFrame(`${server.url}${API_ROUTES.chat}`, chatBody);
      await agentFinished;
      await new Promise((resolve) => setImmediate(resolve)); // let the route's catch/finally run
      expect(log).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});

/**
 * Regression tests for the bugs reported on PR #1. The fixes (5e2687b) are on main and
 * feat/frontend but not on this branch yet, so these are `it.fails` for now. Once this
 * branch picks up 5e2687b they start failing: flip each `it.fails` to `it`.
 */
describe("PR #1 regressions (flip it.fails to it once 5e2687b is merged in)", () => {
  it.fails("(a) accepts an assistant turn with empty content, e.g. a reply stopped before any text", async () => {
    const body = {
      ...chatBody,
      messages: [
        { role: "user", content: "Rank airports" },
        { role: "assistant", content: "" },
        { role: "user", content: "Continue" },
      ],
    };
    await request(appWith()).post(API_ROUTES.chat).send(body).expect(200);
  });

  it.fails("(b) returns 413 for a body over the 1 MB limit, without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const big = { ...chatBody, messages: [{ role: "user", content: "x".repeat(2_000_000) }] };
    const res = await request(appWith()).post(API_ROUTES.chat).send(big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("payload_too_large");
    expect(log).not.toHaveBeenCalled();
  });

  it.fails("(b) returns 415 for an unsupported charset, without logging", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appWith())
      .post(API_ROUTES.chat)
      .set("Content-Type", "application/json; charset=latin-9")
      .send(JSON.stringify(chatBody));
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("bad_request");
    expect(log).not.toHaveBeenCalled();
  });

  it.fails("(d) stops pulling events after the client leaves, even if the agent ignores the signal", async () => {
    let yielded = 0;
    let yieldedAtAbort = -1;
    let resolveFinished!: () => void;
    const agentFinished = new Promise<void>((resolve) => (resolveFinished = resolve));
    const deafAgent: Agent = {
      async *run({ signal }) {
        signal.addEventListener("abort", () => (yieldedAtAbort = yielded));
        try {
          for (let i = 0; i < 100; i++) {
            yield { type: "text_delta", messageId, delta: "." };
            yielded++;
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        } finally {
          resolveFinished();
        }
      },
    };

    const server = await startServer(appWith(deafAgent));
    try {
      await disconnectAfterFirstFrame(`${server.url}${API_ROUTES.chat}`, chatBody);
      await agentFinished;
      expect(yieldedAtAbort).toBeGreaterThanOrEqual(0);
      // The route should break out (calling return()) on the next event, not drain all 100.
      expect(yielded - yieldedAtAbort).toBeLessThanOrEqual(2);
    } finally {
      await server.close();
    }
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    const res = await request(appWith()).get("/api/nope").expect(404);
    expect(res.body).toEqual({ error: { code: "not_found", message: "No route for GET /api/nope" } });
  });
});
