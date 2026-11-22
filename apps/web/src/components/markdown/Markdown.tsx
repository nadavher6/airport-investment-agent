import { memo, type ReactNode } from "react";
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

/**
 * Calls the renderer inside the boundary. Memoized on render + body, so a closed fence is drawn
 * once and not again on every later streamed delta.
 */
const FenceView = memo(function FenceView({ render, body }: { render: FenceRenderer; body: string }) {
  return <>{render(body)}</>;
});

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

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: PreNode["position"];
  children?: HastNode[];
}

/** A closing fence is the last source line, ignoring blockquote markers and list indentation. */
function isClosed(source: string): boolean {
  const lines = source.split("\n");
  return lines.length > 1 && CLOSING_FENCE.test((lines[lines.length - 1] ?? "").replace(/^[\s>]+/, ""));
}

/** Marks each <pre> with whether its fence is closed, from the source text (any nesting depth). */
function rehypeFenceState() {
  return (tree: HastNode, file: { toString(): string }): void => {
    const text = file.toString();
    const walk = (node: HastNode): void => {
      if (node.type === "element" && node.tagName === "pre") {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        const source = start !== undefined && end !== undefined ? text.slice(start, end) : "";
        node.properties = { ...node.properties, "data-closed": isClosed(source) ? "1" : "0" };
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeFenceState];

/** Module-level, so react-markdown sees the same components on every render and keeps the tree. */
const COMPONENTS: Components = {
  a: ({ node: _node, href, children, ...props }) =>
    href ? (
      <a {...props} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // Remote images would leak data to a third party, so only the alt text is shown.
  img: ({ alt }) => <>{alt ?? ""}</>,
  table: ({ node: _node, ...props }) => (
    <div className="md-table-wrap">
      <table {...props} />
    </div>
  ),
  pre: ({ node: hast, children, ...props }) => {
    const node = hast as PreNode | undefined;
    const { "data-closed": closedFlag, ...rest } = props as Record<string, unknown>;
    const code = node?.children?.[0];
    const lang = fenceLang(code);
    if (!lang || !VISUAL_FENCES.has(lang)) return <pre {...(rest as object)}>{children}</pre>;

    const body = (code?.children ?? []).map((c) => c.value ?? "").join("").replace(/\n$/, "");
    if (closedFlag !== "1") {
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

/**
 * Renders markdown from model output. Raw HTML stays off (no rehype-raw), unsafe link targets are
 * dropped to plain text, and images are shown as their alt text. A closed fence is drawn once.
 */
export function Markdown({ text }: MarkdownProps) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
