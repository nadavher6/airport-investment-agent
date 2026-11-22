import type { ToolUseBlock } from "@airport/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolUseBlockView } from "../../components/blocks/ToolUseBlockView";
import { TOOL } from "../../test/fixtures";
import { SCORE_ONE } from "./fixtures";

// A score view that throws while rendering, to prove the card's error boundary.
vi.mock("./ScoreView", () => ({
  ScoreView: () => {
    throw new Error("boom");
  },
}));

describe("score_airports error boundary", () => {
  it("a score view that throws falls back to the generic JSON card; nothing else breaks", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const block: ToolUseBlock = {
      type: "tool_use",
      toolCallId: TOOL,
      name: "score_airports",
      input: { airport_codes: ["LAX"] },
      status: "succeeded",
      output: SCORE_ONE,
    };
    render(
      <div>
        <ToolUseBlockView block={block} />
        <p>after the card</p>
      </div>,
    );
    expect(screen.getByText("after the card")).toBeInTheDocument();
    expect(screen.queryByTestId("score-view")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /score_airports/ }));
    expect(screen.getByText(/"airportCode": "LAX"/)).toBeVisible();
    error.mockRestore();
  });
});
