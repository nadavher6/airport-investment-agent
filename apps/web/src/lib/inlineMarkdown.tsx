import { Fragment, type ReactNode } from "react";

/**
 * Tiny, safe markdown subset: paragraphs, line breaks, **bold**, `code`.
 * Builds React nodes (never innerHTML), so model output can't inject markup.
 */
const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_TOKEN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={i}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export function renderMarkdown(text: string): ReactNode {
  return text
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim() !== "")
    .map((paragraph, i) => (
      <p key={i}>
        {paragraph.split("\n").map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    ));
}
