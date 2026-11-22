import { API_ROUTES, type ModelsResponse } from "@airport/shared";
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
    expect(await screen.findByRole("button", { name: /Gemini 2.5 Flash/ })).toBeEnabled();

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
