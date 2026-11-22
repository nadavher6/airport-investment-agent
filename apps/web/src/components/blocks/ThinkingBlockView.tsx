import { useId, useState } from "react";
import type { ThinkingBlock } from "@airport/shared";
import { ChevronIcon, RadarIcon } from "../icons";

const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

export function ThinkingBlockView({ block }: { block: ThinkingBlock }) {
  const isThinking = block.durationMs === undefined;
  // null = follow the default: expanded while thinking, collapsed once done.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? isThinking;
  const bodyId = useId();

  return (
    <section className="thinking" data-state={isThinking ? "active" : "done"} data-open={open}>
      <button
        type="button"
        className="thinking__header"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setUserOpen(!open)}
      >
        <RadarIcon size={16} className="thinking__icon" />
        <span className="thinking__label">
          {isThinking ? "Thinking" : `Thought for ${formatSeconds(block.durationMs)}`}
        </span>
        <ChevronIcon size={14} className="thinking__chevron" />
      </button>
      <div id={bodyId} className="thinking__body" hidden={!open}>
        <p>{block.text}</p>
      </div>
    </section>
  );
}
