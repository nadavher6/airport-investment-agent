import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Markdown } from "../components/markdown/Markdown";
import { resetFencesForTests } from "../components/markdown/fences";
import { DEMO_FENCES } from "./demo/faaDemo";
import { registerVisuals } from "./registerVisuals";

// The REAL registry and #36's real Markdown component; nothing is mocked.
beforeEach(() => {
  resetFencesForTests();
  registerVisuals();
});

const body = (title: string): { lang: string; body: string } => {
  const f = DEMO_FENCES.find((d) => d.title === title);
  if (!f) throw new Error(`no demo fence ${title}`);
  return f;
};

describe("visual fences through Markdown and the real registry", () => {
  it("renders a closed chart fence (line) as role=img with its label", () => {
    const f = body("Line");
    render(<Markdown text={`Intro\n\n\`\`\`${f.lang}\n${f.body}\n\`\`\`\n\nOutro`} />);
    expect(screen.getByRole("img", { name: /Enplanements, CY2015-CY2024/ })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders a closed chart fence (bar) as role=img with its label", () => {
    const f = body("Bar");
    render(<Markdown text={`\`\`\`${f.lang}\n${f.body}\n\`\`\``} />);
    expect(screen.getByRole("img", { name: /Enplanements, CY2024/ })).toBeInTheDocument();
  });

  it("renders a closed table fence as a labelled table", () => {
    const f = body("Table");
    render(<Markdown text={`\`\`\`${f.lang}\n${f.body}\n\`\`\``} />);
    expect(screen.getByRole("table", { name: "CY2019 vs CY2024" })).toBeInTheDocument();
  });

  it("renders a closed kpi fence as labelled tiles", () => {
    const f = body("KPI");
    const { container } = render(<Markdown text={`\`\`\`${f.lang}\n${f.body}\n\`\`\``} />);
    expect(container.querySelectorAll(".viz-kpi__tile[aria-label]").length).toBeGreaterThan(0);
  });

  it.each(["Line", "Table", "KPI"])("shows the placeholder, not the visual, for an open %s fence", (title) => {
    const f = body(title);
    const open = `\`\`\`${f.lang}\n${f.body}`;
    const { container } = render(<Markdown text={open} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(container.querySelector(".viz-kpi__tile")).toBeNull();
  });

  it("a second registerVisuals() call is harmless: still one visual per fence", () => {
    registerVisuals();
    const f = body("Bar");
    render(<Markdown text={`\`\`\`${f.lang}\n${f.body}\n\`\`\``} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });
});
