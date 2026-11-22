import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { FenceBoundary } from "./FenceBoundary";
import { getFenceRenderer, type FenceRenderer } from "./fences";
import "./markdown.css";

/** Languages that may become visuals. Anything else is always a plain code block. */
const VISUAL_FENCES: ReadonlySet<string> = new Set(["chart", "table", "kpi"]);

const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})\s*$/;

interface MarkdownProps {
  text: string;
}

interface PreNode {
  position?: { start: { offset?: number }; end: { offset?: number } };
  children?: Array<{
    type: string;
    tagName?: string;
    properties?: { className?: unknown };
    children?: Array<{ type: string; value?: string }>;
  }>;
}

function fenceLang(code: NonNullable<PreNode["children"]>[number] | undefined): string | undefined {
  const classes = code?.properties?.className;
  if (!Array.isArray(classes)) return undefined;
  const match = classes.map(String).find((c) => c.startsWith("language-"));
  return match?.slice("language-".length);
}

/** Calls the renderer inside the boundary, so a throw is caught there and not in the parent. */
function FenceView({ render, body }: { render: FenceRenderer; body: string }) {
  return <>{render(body)}</>;
}

function CodeBlock({ body, lang, note }: { body: string; lang?: string; note?: ReactNode }) {
  return (
    <>
      <pre>
        <code className={lang ? `language-${lang}` : undefined}>{body}</code>
      </pre>
      {note}
    </>
  );
}

/**
 * Renders markdown from model output. Raw HTML stays off (no rehype-raw) and the default
 * urlTransform drops javascript: links. Re-rendering on every streamed delta is cheap and safe
 * because partial markdown is just rendered as far as it parses.
 */
export function Markdown({ text }: MarkdownProps) {
  const components: Components = {
    a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
    table: ({ node: _node, ...props }) => (
      <div className="md-table-wrap">
        <table {...props} />
      </div>
    ),
    pre: ({ node: hast, children, ...props }) => {
      const node = hast as PreNode | undefined;
      const code = node?.children?.[0];
      const lang = fenceLang(code);
      if (!lang || !VISUAL_FENCES.has(lang)) return <pre {...props}>{children}</pre>;

      const body = (code?.children ?? []).map((c) => c.value ?? "").join("").replace(/\n$/, "");
      const start = node?.position?.start.offset;
      const end = node?.position?.end.offset;
      const source = start !== undefined && end !== undefined ? text.slice(start, end) : "";
      const lines = source.split("\n");
      const closed = lines.length > 1 && CLOSING_FENCE.test(lines[lines.length - 1] ?? "");

      if (!closed) {
        return (
          <div className="md-fence-pending" role="status">
            Drawing {lang}…
          </div>
        );
      }
      const render = getFenceRenderer(lang);
      if (!render) return <CodeBlock body={body} lang={lang} />;
      return (
        <FenceBoundary
          fallback={<CodeBlock body={body} lang={lang} note={<p className="md-fence-note">Could not draw this {lang}.</p>} />}
        >
          <FenceView render={render} body={body} />
        </FenceBoundary>
      );
    },
  };

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
