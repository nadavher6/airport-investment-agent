import type { AddressInfo } from "node:net";
import { API_ROUTES, asMessageId, asModelId, type AgentEvent } from "@airport/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Agent } from "./agent/agent.ts";
import { createApp } from "./app.ts";
import { DEFAULT_MODEL_ID } from "./catalog/models.ts";
import { parseSse, scriptedAgent, testConfig } from "./test/helpers.ts";

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
  });

  it("aborts the agent run when the client disconnects", async () => {
    let resolveAborted!: () => void;
    const aborted = new Promise<void>((resolve) => (resolveAborted = resolve));
    const hangingAgent: Agent = {
      async *run({ signal }) {
        signal.addEventListener("abort", () => resolveAborted());
        yield { type: "message_start", messageId, modelId: asModelId("m") };
        await new Promise(() => {}); // never finishes on its own
      },
    };

    const server = appWith(hangingAgent).listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const client = new AbortController();
      const res = await fetch(`http://localhost:${port}${API_ROUTES.chat}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatBody),
        signal: client.signal,
      });
      await res.body!.getReader().read(); // first frame arrived
      client.abort();
      await expect(aborted).resolves.toBeUndefined();
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    const res = await request(appWith()).get("/api/nope").expect(404);
    expect(res.body).toEqual({ error: { code: "not_found", message: "No route for GET /api/nope" } });
  });
});
