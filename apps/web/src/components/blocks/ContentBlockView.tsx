import { assertNever, type ContentBlock } from "@airport/shared";
import { Markdown } from "../markdown/Markdown";
import { ThinkingBlockView } from "./ThinkingBlockView";
import { ToolUseBlockView } from "./ToolUseBlockView";
import "./blocks.css";

interface ContentBlockViewProps {
  block: ContentBlock;
  /** True for the trailing block of a message that is still streaming. */
  isLive: boolean;
}

/** One renderer per block type. Adding a block type to the contract makes this fail to compile. */
export function ContentBlockView({ block, isLive }: ContentBlockViewProps) {
  switch (block.type) {
    case "text":
      return <div className={`text-block${isLive ? " is-live" : ""}`}><Markdown text={block.text} /></div>;
    case "thinking":
      return <ThinkingBlockView block={block} />;
    case "tool_use":
      return <ToolUseBlockView block={block} />;
    default:
      return assertNever(block, "content block");
  }
}
