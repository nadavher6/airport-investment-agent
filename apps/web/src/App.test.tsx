import {
  API_ROUTES,
  asModelId,
  nowIso,
  type ChatRequest,
  type ModelsResponse,
  type ProviderHealthResponse,
} from "@airport/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { fullRun, model, MODEL_ID } from "./test/fixtures";

const modelsBody: ModelsResponse = { models: [model()], defaultModelId: MODEL_ID };

/** Routes fetch calls to canned responses, like the real server would. */
function fakeApi({ serverUp = true } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (!serverUp) return new Response("Bad Gateway", { status: 502 });
    switch (String(input)) {
      case API_ROUTES.health:
        return Response.json({ status: "ok", version: "test", uptimeSeconds: 1 });
      case API_ROUTES.models:
        return Response.json(modelsBody);
      case API_ROUTES.chat:
        return new Response(fullRun.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
          headers: { "Content-Type": "text/event-stream" },
        });
      default:
        return new Response("not found", { status: 404 });
    }
  });
}

describe("App", () => {
  it("runs a full conversation turn from a suggestion card", async () => {
    fakeApi();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText("API online")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Gemini 3.5 Flash/ })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Compare LA and Santa Ana/ }));
    await user.keyboard("{Enter}");

    const log = await screen.findByRole("log", { name: "Conversation" });
    expect(within(log).getByText("Compare LA and Santa Ana airport congestion levels.")).toBeInTheDocument();
    expect(await within(log).findByText("SFO is congested.")).toBeInTheDocument();
    expect(within(log).getByRole("button", { name: /Thought for 1.2s/ })).toBeInTheDocument();
    expect(within(log).getByRole("button", { name: /search_airports/ })).toBeInTheDocument();

    // "New chat" returns to the empty state.
    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.getByRole("heading", { name: /terminal go/ })).toBeInTheDocument();
  });

  it("reports a down server in the status pill", async () => {
    fakeApi({ serverUp: false });
    render(<App />);
    expect(await screen.findByText("API offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Models unavailable" })).toBeDisabled();
  });
});

describe("App: switching to Claude (headless session)", () => {
  const claude = model({ id: asModelId("claude-headless"), label: "Claude (headless session)", provider: "claude-headless" });
  const twoModels: ModelsResponse = { models: [model(), claude], defaultModelId: MODEL_ID };
  const health = (status: ProviderHealthResponse["status"], detail: string): ProviderHealthResponse => ({
    provider: "claude-headless",
    status,
    detail,
    checkedAt: nowIso(),
  });

  /** Like fakeApi, but the provider health answer waits until the test releases it. */
  function fakeApiWithClaude(answer: () => Promise<Response>) {
    const chatBodies: ChatRequest[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      switch (String(input)) {
        case API_ROUTES.health:
          return Response.json({ status: "ok", version: "test", uptimeSeconds: 1 });
        case API_ROUTES.models:
          return Response.json(twoModels);
        case "/api/providers/claude-headless/health":
          return answer();
        case API_ROUTES.chat:
          chatBodies.push(JSON.parse(String(init?.body)) as ChatRequest);
          return new Response(fullRun.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""), {
            headers: { "Content-Type": "text/event-stream" },
          });
        default:
          return new Response("not found", { status: 404 });
      }
    });
    return { fetchMock, chatBodies };
  }

  function deferred() {
    let resolve!: (res: Response) => void;
    const promise = new Promise<Response>((r) => (resolve = r));
    return { promise, resolve };
  }

  async function pickClaude(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: /Gemini 3.5 Flash/ }));
    await user.click(screen.getByRole("option", { name: /Claude \(headless session\)/ }));
  }

  it("checks health with a visible checking state, then stays selected and every chat uses it", async () => {
    localStorage.clear();
    const gate = deferred();
    const { fetchMock, chatBodies } = fakeApiWithClaude(() => gate.promise);
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await pickClaude(user);
    expect(await screen.findByText("Checking Claude…")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/providers/claude-headless/health", expect.anything());

    gate.resolve(Response.json(health("ok", "Claude Code 2.1.0 is installed.")));
    expect(await screen.findByText("Claude connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Claude \(headless session\)/ })).toBeEnabled();

    await user.type(screen.getByRole("textbox"), "Which airport?{Enter}");
    await screen.findByText("SFO is congested.");
    expect(chatBodies.at(-1)?.modelId).toBe("claude-headless");

    // Stays selected after a reload, as the picker does today.
    unmount();
    render(<App />);
    expect(await screen.findByRole("button", { name: /Claude \(headless session\)/ })).toBeInTheDocument();
  });

  it("goes back to the previous model with a readable message when the check fails", async () => {
    localStorage.clear();
    fakeApiWithClaude(async () => Response.json(health("unavailable", "The claude binary was not found on PATH.")));
    const user = userEvent.setup();
    render(<App />);

    await pickClaude(user);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't switch to Claude (headless session): The claude binary was not found on PATH.");
    expect(alert).toHaveTextContent("Still using Gemini 3.5 Flash.");
    expect(screen.getByRole("button", { name: /Gemini 3.5 Flash/ })).toBeEnabled();
    expect(localStorage.getItem("runway.model")).not.toBe("claude-headless");
  });

  it("goes back to the previous model when the health request itself fails", async () => {
    localStorage.clear();
    fakeApiWithClaude(async () => new Response("Bad Gateway", { status: 502 }));
    const user = userEvent.setup();
    render(<App />);

    await pickClaude(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't reach the API server/);
    expect(screen.getByRole("button", { name: /Gemini 3.5 Flash/ })).toBeInTheDocument();
  });
});
