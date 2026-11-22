import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Composer, type ComposerHandle } from "./Composer";

function setup(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  const onSend = vi.fn();
  const onStop = vi.fn();
  const ref = createRef<ComposerHandle>();
  render(<Composer ref={ref} isStreaming={false} canSend onSend={onSend} onStop={onStop} toolbar={null} {...props} />);
  return { onSend, onStop, ref, input: screen.getByRole("textbox", { name: "Message the agent" }), user: userEvent.setup() };
}

describe("Composer", () => {
  it("sends on Enter and clears the draft", async () => {
    const { onSend, input, user } = setup();
    await user.type(input, "Compare LAX and SNA{Enter}");
    expect(onSend).toHaveBeenCalledWith("Compare LAX and SNA");
    expect(input).toHaveValue("");
  });

  it("inserts a newline on Shift+Enter instead of sending", async () => {
    const { onSend, input, user } = setup();
    await user.type(input, "line 1{Shift>}{Enter}{/Shift}line 2");
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("line 1\nline 2");
  });

  it("does not send while an IME composition is active", () => {
    const { onSend, input } = setup();
    fireEvent.change(input, { target: { value: "שלום" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends with the button, which is disabled for blank input", async () => {
    const { onSend, input, user } = setup();
    const send = screen.getByRole("button", { name: "Send message" });

    expect(send).toBeDisabled();
    await user.type(input, "   ");
    expect(send).toBeDisabled();

    await user.type(input, "hi");
    await user.click(send);
    expect(onSend).toHaveBeenCalledWith("   hi");
  });

  it("can't send when canSend is false (no model selected)", async () => {
    const { onSend, input, user } = setup({ canSend: false });
    await user.type(input, "hi{Enter}");
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("shows Stop instead of Send while streaming", async () => {
    const { onSend, onStop, input, user } = setup({ isStreaming: true });
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalledOnce();

    await user.type(input, "queued{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("setDraft from a handle fills and focuses the input", () => {
    const { ref, input } = setup();
    act(() => ref.current!.setDraft("What is the unmet demand at SFO?"));
    expect(input).toHaveValue("What is the unmet demand at SFO?");
    expect(input).toHaveFocus();
  });
});
