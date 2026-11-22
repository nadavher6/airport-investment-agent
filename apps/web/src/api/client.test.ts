import { API_ROUTES, type AgentEvent } from "@airport/shared";
import { describe, expect, it, vi } from "vitest";
import { fullRun, MODEL_ID } from "../test/fixtures";
import { api, ApiClientError } from "./client";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sse = (events: AgentEvent[]) =>
  new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
    headers: { "Content-Type": "text/event-stream" },
  });

const request = { modelId: MODEL_ID, messages: [{ role: "user" as const, content: "Hi" }] };

async function caught(promise: Promise<unknown>): Promise<ApiClientError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiClientError);
  return err as ApiClientError;
}

async function drain(iterable: AsyncIterable<AgentEvent>) {
  const events: AgentEvent[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

describe("api client", () => {
  it("GETs JSON from the shared route constants", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ status: "ok", version: "1", uptimeSeconds: 3 }));
    await expect(api.health()).resolves.toEqual({ status: "ok", version: "1", uptimeSeconds: 3 });
    expect(fetchMock).toHaveBeenCalledWith(API_ROUTES.health, {});
  });

  it("turns an ApiErrorBody into an ApiClientError with the server's code", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: { code: "not_found", message: "Nope" } }, 404));
    const err = await caught(api.models());
    expect(err.status).toBe(404);
    expect(err.apiError).toEqual({ code: "not_found", message: "Nope" });
  });

  it("explains a proxy 502 as the server being unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad Gateway", { status: 502 }));
    const err = await caught(api.health());
    expect(err.apiError.message).toBe("Couldn't reach the API server. Is it running?");
  });

  it("falls back to a generic message for other non-JSON failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("oops", { status: 500 }));
    expect((await caught(api.health())).apiError.message).toBe("Request failed (500)");
  });

  it("streamChat POSTs the request and yields parsed events", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(sse(fullRun));
    const events = await drain(api.streamChat(request, new AbortController().signal));

    expect(events).toEqual(fullRun);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(API_ROUTES.chat);
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify(request) });
  });

  it("streamChat skips event types it doesn't know, with a warning, and keeps streaming", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unknown = { type: "usage", tokens: 12 } as unknown as AgentEvent;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(sse([fullRun[0]!, unknown, ...fullRun.slice(1)]));

    expect(await drain(api.streamChat(request, new AbortController().signal))).toEqual(fullRun);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("streamChat reports a malformed frame as a bad response, not a connection problem", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(`data: ${JSON.stringify(fullRun[0])}\n\ndata: {not json\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
    const err = await caught(drain(api.streamChat(request, new AbortController().signal)));
    expect(err.apiError).toEqual({ code: "internal", message: "The server sent a malformed response." });
  });

  it("streamChat throws before yielding when the server rejects the request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(json({ error: { code: "bad_request", message: "Bad" } }, 400));
    const err = await caught(drain(api.streamChat(request, new AbortController().signal)));
    expect(err.apiError.code).toBe("bad_request");
  });
});
