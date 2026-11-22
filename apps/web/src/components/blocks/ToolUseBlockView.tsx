import { useId, useState } from "react";
import type { JsonValue, ToolCallStatus, ToolUseBlock } from "@airport/shared";
import { CheckIcon, ChevronIcon, CrossIcon, ToolIcon } from "../icons";

const STATUS_LABEL: Record<ToolCallStatus, string> = {
  running: "Running",
  succeeded: "Done",
  failed: "Failed",
};

/** First short string argument, shown inline so a collapsed card still says something useful. */
function summarize(input: ToolUseBlock["input"]): string | null {
  const first = Object.values(input).find((v): v is string => typeof v === "string" && v.trim() !== "");
  if (!first) return null;
  return first.length > 64 ? `${first.slice(0, 64)}…` : first;
}

const pretty = (value: JsonValue) => JSON.stringify(value, null, 2);

export function ToolUseBlockView({ block }: { block: ToolUseBlock }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const summary = summarize(block.input);

  return (
    <section className="tool-card" data-status={block.status} data-open={open}>
      <button
        type="button"
        className="tool-card__header"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
      >
        <span className="tool-card__glyph" aria-hidden="true">
          <ToolIcon size={14} />
        </span>
        <span className="tool-card__name">{block.name}</span>
        {summary && <span className="tool-card__summary">{summary}</span>}
        <span className="tool-card__status">
          {block.status === "running" && <span className="tool-card__spinner" aria-hidden="true" />}
          {block.status === "succeeded" && <CheckIcon size={14} />}
          {block.status === "failed" && <CrossIcon size={14} />}
          {STATUS_LABEL[block.status]}
        </span>
        <ChevronIcon size={14} className="tool-card__chevron" />
      </button>

      <div id={bodyId} className="tool-card__body" hidden={!open}>
        <div className="tool-card__section">
          <span className="eyebrow">Input</span>
          <pre>{pretty(block.input)}</pre>
        </div>
        {block.status === "succeeded" && block.output !== undefined && (
          <div className="tool-card__section">
            <span className="eyebrow">Output</span>
            <pre>{pretty(block.output)}</pre>
          </div>
        )}
        {block.status === "failed" && (
          <div className="tool-card__section">
            <span className="eyebrow">Error</span>
            <pre className="tool-card__error">{block.errorMessage ?? "Unknown error"}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
