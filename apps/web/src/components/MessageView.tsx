import { memo } from "react";
import type { ChatMessage, ModelInfo } from "@airport/shared";
import { isUnsent } from "../lib/messages";
import { ContentBlockView } from "./blocks/ContentBlockView";
import { LogoMark } from "./icons";
import "./MessageView.css";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

interface MessageViewProps {
  message: ChatMessage;
  model: ModelInfo | undefined;
}

// Memoized: the reducer keeps unchanged messages referentially stable, so per-token work touches only the live one.
export const MessageView = memo(function MessageView({ message, model }: MessageViewProps) {
  const time = timeFormat.format(new Date(message.createdAt));

  if (message.role === "user") {
    const text = message.blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
    const unsent = isUnsent(message);
    return (
      <article className="message message--user" aria-label={unsent ? `You, ${time}, not sent` : `You, ${time}`}>
        {unsent && (
          <span className="message__tag message__tag--error" title="This message failed and isn't sent with later ones">
            Not sent
          </span>
        )}
        <div className="message__bubble">{text}</div>
      </article>
    );
  }

  const isStreaming = message.status === "streaming";
  const lastIndex = message.blocks.length - 1;

  return (
    <article className="message message--assistant" aria-label={`Agent, ${time}`} aria-busy={isStreaming}>
      <header className="message__meta">
        <LogoMark size={20} />
        <span className="message__model">{model?.label ?? message.modelId ?? "Agent"}</span>
        <time className="message__time" dateTime={message.createdAt}>
          {time}
        </time>
        {message.status === "cancelled" && <span className="message__tag">Stopped</span>}
        {message.status === "error" && <span className="message__tag message__tag--error">Interrupted</span>}
      </header>

      <div className="message__blocks">
        {message.blocks.map((block, index) => (
          <ContentBlockView
            key={block.type === "tool_use" ? block.toolCallId : `${block.type}-${index}`}
            block={block}
            isLive={isStreaming && index === lastIndex}
          />
        ))}
        {isStreaming && message.blocks.length === 0 && <PendingDots label="Preparing response" />}
      </div>
    </article>
  );
});

/** Shown between Send and the first streamed event. */
export function PendingDots({ label }: { label: string }) {
  return (
    <div className="pending" role="status">
      <span className="pending__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="pending__label">{label}</span>
    </div>
  );
}
