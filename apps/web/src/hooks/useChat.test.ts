import type { AgentEvent, ChatRequest } from "@airport/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { api, ApiClientError } from "../api/client";
import { fullRun, MODEL_ID } from "../test/fixtures";
import { useChat } from "./useChat";

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
      { modelId: MODEL_ID, messages: [{ role: "user", content: "How busy is SFO?" }] },
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

  it("ignores a second send while a reply is still streaming", async () => {
    const stream = vi.spyOn(api, "streamChat").mockImplementation(hangingStream);
    const { result } = renderHook(() => useChat(MODEL_ID));

    act(() => void result.current.send("One"));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await act(() => result.current.send("Two"));

    expect(stream).toHaveBeenCalledTimes(1);
    act(() => result.current.stop());
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
});
