import { describe, expect, it } from "vitest";
import { LlmError, type LlmClient, type LlmStreamEvent } from "./llmClient.ts";

/** Test-only. Each LlmClient's test supplies clients backed by its own fake (binary, HTTP server…). */
export interface LlmClientContractHarness {
  /** stream() answers with some text and ends normally; health() is ok. */
  answering(): LlmClient;
  /** stream() fails because the login/key is rejected. */
  authFailing(): LlmClient;
  /** The provider is not installed or not configured at all. */
  unavailable(): LlmClient;
  /** stream() yields one text delta, then waits until aborted. */
  hanging(): LlmClient;
}

const request = (signal = new AbortController().signal) => ({
  messages: [{ role: "user" as const, content: "Which airport should we expand?" }],
  signal,
});

async function collect(stream: AsyncIterable<LlmStreamEvent>): Promise<LlmStreamEvent[]> {
  const events: LlmStreamEvent[] = [];
  for await (const event of stream) events.push(event);
  return events;
}

const failure = (promise: Promise<unknown>) => promise.then(() => undefined, (err: unknown) => err);

/** The behaviour every LlmClient must have. Call it from the client's own test file. */
export function describeLlmClientContract(name: string, harness: LlmClientContractHarness): void {
  describe(`LlmClient contract: ${name}`, () => {
    it("streams text deltas and ends with exactly one done event, last", async () => {
      const events = await collect(harness.answering().stream(request()));
      expect(events.at(-1)?.type).toBe("done");
      expect(events.filter((e) => e.type === "done")).toHaveLength(1);
      const text = events.flatMap((e) => (e.type === "text_delta" ? [e.text] : [])).join("");
      expect(text.length).toBeGreaterThan(0);
    });

    it("throws an LlmError with code auth when the login is rejected", async () => {
      const err = await failure(collect(harness.authFailing().stream(request())));
      expect(err).toBeInstanceOf(LlmError);
      expect(err).toMatchObject({ code: "auth" });
    });

    it("throws an LlmError with code unavailable when the provider is missing", async () => {
      const err = await failure(collect(harness.unavailable().stream(request())));
      expect(err).toBeInstanceOf(LlmError);
      expect(err).toMatchObject({ code: "unavailable" });
    });

    it("stops promptly when the signal is aborted", { timeout: 5000 }, async () => {
      const controller = new AbortController();
      const iterator = harness.hanging().stream(request(controller.signal))[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toMatchObject({ type: "text_delta" });
      controller.abort();
      const next = await iterator.next().catch(() => ({ done: true, value: undefined }));
      expect(next.done).toBe(true);
    });

    it("reports health as ok or unavailable with a plain-English detail", async () => {
      expect(await harness.answering().health()).toEqual({ status: "ok", detail: expect.any(String) });
      const missing = await harness.unavailable().health();
      expect(missing.status).toBe("unavailable");
      expect(missing.detail.length).toBeGreaterThan(0);
    });
  });
}
