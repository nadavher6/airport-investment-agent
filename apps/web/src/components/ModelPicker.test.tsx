import { asModelId } from "@airport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ModelsState } from "../hooks/useModels";
import { model } from "../test/fixtures";
import { ModelPicker } from "./ModelPicker";

const gemini = model();
const llama = model({ id: asModelId("llama"), label: "Llama 3.3 70B", provider: "groq", capabilities: { thinking: false, toolUse: true } });
const gpt = model({ id: asModelId("gpt"), label: "GPT-OSS 120B", provider: "openrouter", available: false });
const claude = model({ id: asModelId("claude-headless"), label: "Claude (headless session)", provider: "claude-headless" });
const ready: ModelsState = { status: "ready", models: [gemini, llama, gpt] };

function setup(state: ModelsState = ready) {
  const onSelect = vi.fn();
  render(<ModelPicker state={state} selected={state.status === "ready" ? gemini : null} onSelect={onSelect} />);
  return { onSelect, trigger: screen.getByRole("button", { name: /Gemini|Loading|unavailable/ }), user: userEvent.setup() };
}

describe("ModelPicker", () => {
  it("opens a listbox with every model, the selected one marked, and capability chips", async () => {
    const { trigger, user } = setup();
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveTextContent("Tools");
    expect(options[1]).not.toHaveTextContent("Thinking");
    expect(options[2]).toHaveAttribute("aria-disabled", "true");
    expect(options[2]).toHaveTextContent("No API key");
  });

  it("selects with the keyboard and returns focus to the trigger", async () => {
    const { onSelect, trigger, user } = setup();
    await user.click(trigger);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledWith(llama.id);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("wraps around with the arrow keys", async () => {
    const { onSelect, trigger, user } = setup();
    await user.click(trigger);
    await user.keyboard("{ArrowUp}{ArrowUp}{Enter}"); // gemini -> gpt (disabled) -> llama
    expect(onSelect).toHaveBeenCalledWith(llama.id);
  });

  it("won't select an unavailable model", async () => {
    const { onSelect, trigger, user } = setup();
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /GPT-OSS/ }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes on Escape and on a click outside", async () => {
    const { trigger, user } = setup();
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();

    await user.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("lists Claude (headless session) as a selectable option", async () => {
    const onSelect = vi.fn();
    render(<ModelPicker state={{ status: "ready", models: [gemini, claude] }} selected={gemini} onSelect={onSelect} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Gemini/ }));
    await user.click(screen.getByRole("option", { name: /Claude \(headless session\)/ }));
    expect(onSelect).toHaveBeenCalledWith(claude.id);
  });

  it("is disabled while models load or failed to load", () => {
    setup({ status: "loading" });
    expect(screen.getByRole("button", { name: "Loading models…" })).toBeDisabled();
  });
});
