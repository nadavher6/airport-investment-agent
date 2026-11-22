import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Markdown } from "./Markdown";
import { getFenceRenderer, registerFence, resetFencesForTests } from "./fences";

beforeEach(resetFencesForTests);
afterEach(() => vi.restoreAllMocks());

describe("fence registry", () => {
  it("registers, gets, and returns undefined for an unknown language", () => {
    const render = () => "x";
    expect(getFenceRenderer("chart")).toBeUndefined();
    registerFence("chart", render);
    expect(getFenceRenderer("chart")).toBe(render);
    expect(getFenceRenderer("nope")).toBeUndefined();
  });
});

describe("Markdown", () => {
  it("renders headings, lists, bold, links and a GFM table", () => {
    const { container } = render(
      <Markdown text={"# Title\n\n- a\n- b\n\n**bold** [site](https://example.com)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n"} />,
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    const link = screen.getByRole("link", { name: "site" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(container.querySelectorAll("table th")).toHaveLength(2);
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument();
  });

  it("does not render raw HTML: no script, no onerror", () => {
    const { container } = render(<Markdown text={'hi <script>window.__pwned = 1</script> <img src=x onerror="window.__pwned = 1">'} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("drops javascript: link targets", () => {
    const { container } = render(<Markdown text="[x](javascript:alert(1))" />);
    const href = container.querySelector("a")?.getAttribute("href") ?? "";
    expect(href).not.toMatch(/javascript:/i);
  });

  it("calls the registered renderer with the body of a closed chart fence", () => {
    const chart = vi.fn((body: string) => <div data-testid="chart">{body}</div>);
    registerFence("chart", chart);
    render(<Markdown text={'before\n\n```chart\n{"a":1}\n```\n\nafter'} />);
    expect(chart).toHaveBeenCalledWith('{"a":1}');
    expect(screen.getByTestId("chart")).toHaveTextContent('{"a":1}');
    expect(screen.getByText("after")).toBeInTheDocument();
  });

  it("shows a placeholder while the fence is open, then the renderer once closed", () => {
    const chart = vi.fn((body: string) => <div data-testid="chart">{body}</div>);
    registerFence("chart", chart);
    const { rerender } = render(<Markdown text={'```chart\n{"a":'} />);
    expect(screen.getByRole("status")).toHaveTextContent("Drawing chart");
    expect(chart).not.toHaveBeenCalled();

    rerender(<Markdown text={'```chart\n{"a":1}\n```'} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(chart).toHaveBeenCalledTimes(1);
  });

  it("shows the placeholder for an open fence even with no renderer, and a code block once closed", () => {
    const { container, rerender } = render(<Markdown text={"```kpi\n{"} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<Markdown text={"```kpi\n{}\n```"} />);
    expect(container.querySelector("pre code")?.textContent).toBe("{}");
  });

  it("renders an unknown language as a normal code block", () => {
    const { container } = render(<Markdown text={"```python\nprint(1)\n```"} />);
    expect(container.querySelector("pre code.language-python")?.textContent).toBe("print(1)\n");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("falls back to a code block plus a note when a renderer throws, and the rest still renders", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    registerFence("chart", () => {
      throw new Error("boom");
    });
    const { container } = render(<Markdown text={"before\n\n```chart\n{bad\n```\n\nafter"} />);
    expect(container.querySelector("pre code")?.textContent).toBe("{bad");
    expect(screen.getByText(/Could not draw this chart/)).toBeInTheDocument();
    expect(screen.getByText("before")).toBeInTheDocument();
    expect(screen.getByText("after")).toBeInTheDocument();
  });

  it("does not crash on partial markdown", () => {
    for (const text of ["**bol", "| a | b |\n|--", "[link](http", "```", "- ", "<div"]) {
      expect(() => render(<Markdown text={text} />)).not.toThrow();
    }
  });

  it("draws a closed fence once, however many deltas follow it", () => {
    const chart = vi.fn((body: string) => <div data-testid="chart">{body}</div>);
    registerFence("chart", chart);
    const head = 'intro\n\n```chart\n{"a":1}\n```\n\n';
    const { rerender } = render(<Markdown text={head} />);
    let text = head;
    for (let i = 0; i < 50; i++) {
      text += "word ";
      rerender(<Markdown text={text} />);
    }
    expect(screen.getByTestId("chart")).toBeInTheDocument();
    expect(chart).toHaveBeenCalledTimes(1);
  });

  it("draws a registered fence inside a blockquote and a list once closed", () => {
    registerFence("chart", (body) => <div data-testid="chart">{body}</div>);
    const open = render(<Markdown text={"> ```chart\n> {\"a\":"} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    open.unmount();
    const quote = render(<Markdown text={'> ```chart\n> {"a":1}\n> ```'} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("chart")).toBeInTheDocument();
    quote.unmount();
    render(<Markdown text={'- item\n\n  ```chart\n  {"b":2}\n  ```'} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("chart")).toBeInTheDocument();
  });

  it("renders a dropped javascript: or data: link as plain text", () => {
    const { container } = render(<Markdown text={"[x](javascript:alert(1)) and [y](data:text/html,hi)"} />);
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toMatch(/href=|target=/);
    expect(container.textContent).toContain("x and y");
  });

  it("never renders an image: only the alt text", () => {
    const { container } = render(<Markdown text={"![the alt](https://evil.example/p.png?d=1) ![d](data:image/png;base64,AAAA)"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toMatch(/evil\.example|data:image/);
    expect(container.textContent).toContain("the alt");
  });

  it.each([
    ["iframe", '<iframe src="https://evil.example"></iframe>'],
    ["svg onload", '<svg onload="window.__pwned = 1"><circle/></svg>'],
    ["raw javascript anchor", '<a href="javascript:window.__pwned = 1">go</a>'],
    ["data link", "[x](data:text/html;base64,PHNjcmlwdD4=)"],
    ["data image", "![x](data:text/html;base64,PHNjcmlwdD4=)"],
  ])("is inert for %s", (_name, text) => {
    const { container } = render(<Markdown text={text} />);
    expect(container.querySelector("iframe, svg, script, img, [onload], [onerror]")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("keeps drawing the good fence when another fence's renderer throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    registerFence("table", () => {
      throw new Error("boom");
    });
    registerFence("kpi", (body) => <div data-testid="kpi">{body}</div>);
    const { container } = render(<Markdown text={"```table\n{bad\n```\n\n```kpi\n{\"ok\":1}\n```"} />);
    expect(screen.getByTestId("kpi")).toHaveTextContent('{"ok":1}');
    expect(container.querySelector("pre code")?.textContent).toBe("{bad");
    expect(screen.getByText(/Could not draw this table/)).toBeInTheDocument();
  });
});
