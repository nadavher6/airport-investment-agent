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

/**
 * First short argument, shown inline so a collapsed card still says something useful: the first
 * non-empty string, or else the first array of strings joined ("LAX, SNA"). Long text is cut.
 */
function summarize(input: ToolUseBlock["input"]): string | null {
  const values = Object.values(input);
  const text =
    values.find((v): v is string => typeof v === "string" && v.trim() !== "") ??
    values
      .map((v) => (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? (v as string[]).join(", ") : ""))
      .find((j) => j.trim() !== "");
  if (!text) return null;
  return text.length > 64 ? `${text.slice(0, 64)}…` : text;
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
  // A score card opens by default so the result is visible; every other card starts closed.
  const [open, setOpen] = useState(score !== undefined);
  const [showData, setShowData] = useState(false);
  const bodyId = useId();
  const dataId = useId();
  const summary: ReactNode = summarize(block.input);
  const details = <ToolDetails block={block} />;

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

      {score ? (
        <div id={bodyId} className="tool-card__score" hidden={!open}>
          <ScoreView result={score} />
          <button
            type="button"
            className="tool-card__show-data"
            aria-expanded={showData}
            aria-controls={dataId}
            onClick={() => setShowData(!showData)}
          >
            {showData ? "Hide data" : "Show data"}
          </button>
          <div id={dataId} className="tool-card__body" hidden={!showData}>
            {details}
          </div>
        </div>
      ) : (
        <div id={bodyId} className="tool-card__body" hidden={!open}>
          {details}
        </div>
      )}
    </section>
  );
}

function ToolDetails({ block }: { block: ToolUseBlock }) {
  return (
    <>
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
    </>
  );
}
