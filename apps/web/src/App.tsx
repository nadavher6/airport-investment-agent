import { useRef } from "react";
import type { ModelId, ModelInfo } from "@airport/shared";
import { Composer, type ComposerHandle } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";
import { MessageView, PendingDots } from "./components/MessageView";
import { ModelPicker } from "./components/ModelPicker";
import { TopBar } from "./components/TopBar";
import { useChat } from "./hooks/useChat";
import { useHealth } from "./hooks/useHealth";
import { useModels } from "./hooks/useModels";
import { useStickToBottom } from "./hooks/useStickToBottom";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

export function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const connection = useHealth();
  const models = useModels();
  const chat = useChat(models.selected?.id ?? null);
  const composerRef = useRef<ComposerHandle>(null);
  const isEmpty = chat.messages.length === 0;
  // The empty state is a landing page: don't pin it to the bottom.
  const { scrollRef, contentRef, stick } = useStickToBottom<HTMLElement, HTMLDivElement>(!isEmpty);

  const modelById = (id: ModelId | undefined): ModelInfo | undefined =>
    models.state.status === "ready" ? models.state.models.find((m) => m.id === id) : undefined;

  const send = (text: string) => {
    stick();
    void chat.send(text);
  };

  const reset = () => {
    chat.reset();
    composerRef.current?.focus();
  };

  const awaitingFirstEvent = chat.isStreaming && chat.messages.at(-1)?.role === "user";

  return (
    <div className="app">
      <TopBar
        connection={connection}
        theme={theme}
        onToggleTheme={toggleTheme}
        canReset={!isEmpty}
        onReset={reset}
      />

      <main className="thread" ref={scrollRef}>
        <div className="thread__column" ref={contentRef}>
          {isEmpty ? (
            <EmptyState onPick={(prompt) => composerRef.current?.setDraft(prompt)} />
          ) : (
            <div className="thread__messages" role="log" aria-label="Conversation">
              {chat.messages.map((message) => (
                <MessageView key={message.id} message={message} model={modelById(message.modelId)} />
              ))}
              {awaitingFirstEvent && <PendingDots label="Contacting agent" />}
            </div>
          )}

          {chat.lastError && (
            <div className="notice notice--error" role="alert">
              <span className="notice__code">{chat.lastError.code}</span>
              {chat.lastError.message}
            </div>
          )}
        </div>
      </main>

      <Composer
        ref={composerRef}
        isStreaming={chat.isStreaming}
        canSend={models.selected !== null}
        onSend={send}
        onStop={chat.stop}
        toolbar={
          <ModelPicker
            state={models.state}
            selected={models.selected}
            onSelect={models.select}
            disabled={chat.isStreaming}
          />
        }
      />
    </div>
  );
}
