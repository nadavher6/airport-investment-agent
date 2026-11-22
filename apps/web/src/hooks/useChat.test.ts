import {
  CONVERSATION_ID_PATTERN,
  MAX_CONVERSATION_ID_LENGTH,
  MIN_CONVERSATION_ID_LENGTH,
  type AgentEvent,
  type ChatRequest,
} from "@airport/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiClientError } from "../api/client";
import { fullRun, MODEL_ID } from "../test/fixtures";
import { useChat } from "./useChat";

afterEach(() => vi.unstubAllGlobals());

async function* replay(events: AgentEvent[]) {
  yield* events;
}

/** Emits message_start, then waits until aborted, like a real stream does. */
function hangingStream(_request: ChatRequest, signal: AbortSignal): AsyncGenerator<AgentEvent> {
  return (async function* () {
    yield fullRun[0]!;
    await new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))),
    );
  })();
}

describe("useChat", () => {
  it("sends the user's message and applies the streamed reply", async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(() => replay(fullRun));
    const { result } = renderHook(() => useChat(MODEL_ID));

    await act(() => result.current.send("  How busy is SFO?  "));

    expect(stream).toHaveBeenCalledWith(
      { modelId: MODEL_ID, conversationId: expect.any(String), messages: [{ role: "user", content: "How busy is SFO?" }] },
      expect.any(AbortSignal),
    );
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages.map((m) => [m.role, m.status])).toEqual([
      ["user", "complete"],
      ["assistant", "complete"],
    ]);
  });

  it("sends earlier turns as history on the next message", async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(() => replay(fullRun));
    const { result } = renderHook(() => useChat(MODEL_ID));

    await act(() => result.current.send("First"));
    await act(() => result.current.send("Second"));

    expect(stream.mock.calls[1]![0].messages).toEqual([
      { role: "user", content: "First" },
      { role: "assistant", content: "SFO is congested." },
      { role: "user", content: "Second" },
    ]);
  });

  it("ignores blank input and does nothing without a model", async () => {
    const stream = vi.spyOn(api, "streamChat");
    const { result, rerender } = renderHook(({ id }) => useChat(id), { initialProps: { id: MODEL_ID as typeof MODEL_ID | null } });

    await act(() => result.current.send("   "));
    rerender({ id: null });
    await act(() => result.current.send("hello"));

    expect(stream).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("stop() aborts the stream and marks the reply cancelled", async () => {
    vi.spyOn(api, "streamChat").mockImplementation(hangingStream);
    const { result } = renderHook(() => useChat(MODEL_ID));

    let sending!: Promise<void>;
    act(() => {
      sending = result.current.send("Hi");
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      result.current.stop();
      await sending;
    });

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.messages[1]!.status).toBe("cancelled");
    expect(result.current.lastError).toBeNull();
  });

  it("ignores a second send while a reply is still streaming", { timeout: 1000 }, async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(hangingStream);
    const { result } = renderHook(() => useChat(MODEL_ID));

    let first!: Promise<void>;
    act(() => {
      first = result.current.send("One");
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await act(() => result.current.send("Two"));

    expect(stream).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.stop();
      await first;
    });
  });

  it("reset() aborts an in-flight stream and leaves an empty, idle chat", { timeout: 1000 }, async () => {
    let signal!: AbortSignal;
    vi.spyOn(api, "streamChat").mockImplementation((request, s) => {
      signal = s;
      return hangingStream(request, s);
    });
    const { result } = renderHook(() => useChat(MODEL_ID));

    let sending!: Promise<void>;
    act(() => {
      sending = result.current.send("Hi");
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(async () => {
      result.current.reset();
      await sending;
    });

    expect(signal.aborted).toBe(true);
    expect(result.current.messages).toEqual([]);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.lastError).toBeNull();
  });

  it("aborts an in-flight stream on unmount", { timeout: 1000 }, async () => {
    let signal!: AbortSignal;
    vi.spyOn(api, "streamChat").mockImplementation((request, s) => {
      signal = s;
      return hangingStream(request, s);
    });
    const { result, unmount } = renderHook(() => useChat(MODEL_ID));

    let sending!: Promise<void>;
    act(() => {
      sending = result.current.send("Hi");
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    unmount();
    await sending;

    expect(signal.aborted).toBe(true);
  });

  it("surfaces the server's error when the request is rejected", async () => {
    vi.spyOn(api, "streamChat").mockImplementation(() => {
      throw new ApiClientError({ code: "model_unavailable", message: "No key" }, 503);
    });
    const { result } = renderHook(() => useChat(MODEL_ID));

    await act(() => result.current.send("Hi"));

    expect(result.current.lastError).toEqual({ code: "model_unavailable", message: "No key" });
    expect(result.current.isStreaming).toBe(false);
  });

  it("shows a connection error for network failures", async () => {
    vi.spyOn(api, "streamChat").mockImplementation(() => {
      throw new TypeError("Failed to fetch");
    });
    const { result } = renderHook(() => useChat(MODEL_ID));

    await act(() => result.current.send("Hi"));

    expect(result.current.lastError?.message).toBe("Couldn't reach the agent. Is the server running?");
  });

  it("sends the same conversationId on every turn of a chat and a new one after reset (#50)", async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(() => replay(fullRun));
    const { result } = renderHook(() => useChat(MODEL_ID));

    await act(() => result.current.send("First"));
    await act(() => result.current.send("Second"));
    act(() => result.current.reset());
    await act(() => result.current.send("New chat"));

    const ids = stream.mock.calls.map((call) => call[0].conversationId);
    expect(ids[0]).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(ids[2]).not.toBe(ids[0]);
  });

  it("gives two separate chats (two hook instances) different conversationIds (#50)", async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(() => replay(fullRun));
    const a = renderHook(() => useChat(MODEL_ID));
    const b = renderHook(() => useChat(MODEL_ID));

    await act(() => a.result.current.send("Hi"));
    await act(() => b.result.current.send("Hi"));

    expect(stream.mock.calls[0]![0].conversationId).not.toBe(stream.mock.calls[1]![0].conversationId);
  });

  it("keeps the same conversationId across re-renders (#50)", async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(() => replay(fullRun));
    const spy = vi.spyOn(crypto, "randomUUID");
    const { result, rerender } = renderHook(() => useChat(MODEL_ID));
    const callsAfterFirstRender = spy.mock.calls.length;
    rerender();
    rerender();
    expect(spy.mock.calls.length).toBe(callsAfterFirstRender);
    await act(() => result.current.send("Hi"));
    rerender();
    await act(() => result.current.send("Again"));
    expect(stream.mock.calls[1]![0].conversationId).toBe(stream.mock.calls[0]![0].conversationId);
    spy.mockRestore();
  });

  it("falls back to getRandomValues when crypto.randomUUID is missing, and the id passes the server rule (#50)", async () => {
    vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const stream = vi.spyOn(api, "streamChat").mockImplementation(() => replay(fullRun));
    const { result } = renderHook(() => useChat(MODEL_ID)); // the first render must not throw
    await act(() => result.current.send("Hi"));
    const id = stream.mock.calls[0]![0].conversationId as string;
    expect(id).toMatch(CONVERSATION_ID_PATTERN);
    expect(id.length).toBeGreaterThanOrEqual(MIN_CONVERSATION_ID_LENGTH);
    expect(id.length).toBeLessThanOrEqual(MAX_CONVERSATION_ID_LENGTH);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
