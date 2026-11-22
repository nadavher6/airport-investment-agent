import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";
import { registerCaveats } from "./caveats";
import { resetFencesForTests } from "./fences";

beforeEach(() => {
  resetFencesForTests();
  registerCaveats();
});

/** The text the server streams for a final answer (#63): bold summary, markdown body, caveats fence. */
const ANSWER = "**ATL had 52.7M enplanements in 2024.**\n\nUp **4%** on 2023.\n\n```caveats\n- Enplanements are boardings.\n- 2024 only.\n```";

describe("a final answer (#63)", () => {
  it("renders the summary in bold, then the markdown, then the caveats as a small muted list", () => {
    const { container } = render(<Markdown text={ANSWER} />);
    expect(container.querySelector("p strong")?.textContent).toBe("ATL had 52.7M enplanements in 2024.");
    const list = screen.getByRole("list", { name: "Caveats" });
    expect(list).toHaveClass("md-caveats");
    expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Enplanements are boardings.", "2024 only."]);
    expect(container.textContent).not.toContain("```");
    expect(container.querySelector("pre")).toBeNull();
  });

  it("an open caveats fence (still streaming) shows the pending note, not the raw lines", () => {
    const { container } = render(<Markdown text={"Body.\n\n```caveats\n- one"} />);
    expect(container.querySelector(".md-caveats")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
