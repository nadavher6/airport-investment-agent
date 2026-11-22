import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./inlineMarkdown";

const html = (text: string) => render(<div>{renderMarkdown(text)}</div>).container.firstElementChild!.innerHTML;

describe("renderMarkdown", () => {
  it("splits paragraphs on blank lines and keeps single newlines as <br>", () => {
    expect(html("one\ntwo\n\nthree")).toBe("<p>one<br>two</p><p>three</p>");
  });

  it("renders **bold** and `code`", () => {
    expect(html("a **b** `c`")).toBe("<p>a <strong>b</strong> <code>c</code></p>");
  });

  it("leaves unclosed markers as plain text", () => {
    expect(html("**open and `tick")).toBe("<p>**open and `tick</p>");
  });

  it("never interprets HTML from model output", () => {
    const { container } = render(<div>{renderMarkdown('<img src=x onerror="alert(1)"> **<b>hi</b>**')}</div>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });
});
