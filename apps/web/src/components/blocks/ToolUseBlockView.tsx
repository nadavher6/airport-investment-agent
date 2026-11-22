import { useId, useMemo, useState, type ReactNode } from "react";
import type { JsonValue, ToolCallStatus, ToolUseBlock } from "@airport/shared";
import { CheckIcon, ChevronIcon, CrossIcon, ToolIcon } from "../icons";
import { FenceBoundary } from "../markdown/FenceBoundary";
import { ScoreView } from "../../visuals/score/ScoreView";
import { SCORE_TOOL, parseScoreResult, type ScoreResult } from "../../visuals/score/spec";

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

/**
 * A tool call card. A succeeded `score_airports` call whose output passes the score check is
 * drawn from the data by ScoreView (#41), with the raw JSON behind "Show data"; anything else,
 * or a score view that throws, is the generic card with the JSON.
 */
export function ToolUseBlockView({ block }: { block: ToolUseBlock }) {
  const output = block.status === "succeeded" ? block.output : undefined;
  const isScore = block.name === SCORE_TOOL && output !== undefined;
  const score = useMemo(() => (isScore ? parseScoreResult(output) : null), [isScore, output]);
  if (!score?.ok) return <ToolCard block={block} />;
  return (
    <FenceBoundary key={JSON.stringify(output)} fallback={<ToolCard block={block} />}>
      <ToolCard block={block} score={score.result} />
    </FenceBoundary>
  );
}

function ToolCard({ block, score }: { block: ToolUseBlock; score?: ScoreResult }) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const summary: ReactNode = score ? (open ? "Hide data" : "Show data") : summarize(block.input);

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

      {score && (
        <div className="tool-card__score">
          <ScoreView result={score} />
        </div>
      )}

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
