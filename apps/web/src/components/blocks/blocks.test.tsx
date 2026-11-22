import type { ToolUseBlock } from "@airport/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TOOL } from "../../test/fixtures";
import { ContentBlockView } from "./ContentBlockView";
import { ThinkingBlockView } from "./ThinkingBlockView";
import { ToolUseBlockView } from "./ToolUseBlockView";

describe("ThinkingBlockView", () => {
  it("is expanded with a live label while thinking", () => {
    render(<ThinkingBlockView block={{ type: "thinking", text: "Checking capacity" }} />);
    expect(screen.getByRole("button", { name: /Thinking/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Checking capacity")).toBeVisible();
  });

  it("collapses to a duration once done, and can be re-opened", async () => {
    render(<ThinkingBlockView block={{ type: "thinking", text: "Checking capacity", durationMs: 1234 }} />);
    const toggle = screen.getByRole("button", { name: /Thought for 1.2s/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Checking capacity")).not.toBeVisible();

    await userEvent.click(toggle);
    expect(screen.getByText("Checking capacity")).toBeVisible();
  });

  it("collapses automatically when thinking finishes", () => {
    const { rerender } = render(<ThinkingBlockView block={{ type: "thinking", text: "x" }} />);
    rerender(<ThinkingBlockView block={{ type: "thinking", text: "x", durationMs: 15_000 }} />);
    expect(screen.getByRole("button", { name: /Thought for 15s/ })).toHaveAttribute("aria-expanded", "false");
  });
});

describe("ToolUseBlockView", () => {
  const base: ToolUseBlock = {
    type: "tool_use",
    toolCallId: TOOL,
    name: "search_airports",
    input: { query: "New England hubs", limit: 5 },
    status: "running",
  };

  it("starts collapsed, showing the tool name, first string argument and status", () => {
    render(<ToolUseBlockView block={base} />);
    expect(screen.getByRole("button", { name: /search_airports/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("New England hubs")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText(/"limit": 5/)).not.toBeVisible();
  });

  it("expands to show input and output once succeeded", async () => {
    render(<ToolUseBlockView block={{ ...base, status: "succeeded", output: { airports: ["BOS"] } }} />);
    await userEvent.click(screen.getByRole("button", { name: /search_airports/ }));
    expect(screen.getByText(/"limit": 5/)).toBeVisible();
    expect(screen.getByText(/"BOS"/)).toBeVisible();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows the error message when the call failed", async () => {
    render(<ToolUseBlockView block={{ ...base, status: "failed", errorMessage: "FAA API timed out" }} />);
    await userEvent.click(screen.getByRole("button", { name: /search_airports/ }));
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("FAA API timed out")).toBeVisible();
  });
});

describe("ContentBlockView", () => {
  it("renders text blocks as markdown and marks the live one", () => {
    const { container } = render(<ContentBlockView block={{ type: "text", text: "**Bold** answer" }} isLive />);
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(container.querySelector(".text-block.is-live")).not.toBeNull();
  });
});
