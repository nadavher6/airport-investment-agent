import {
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { ArrowUpIcon, StopIcon } from "./icons";
import "./Composer.css";

export interface ComposerHandle {
  /** Replace the draft (e.g. from a suggestion) and focus the input. */
  setDraft: (text: string) => void;
  focus: () => void;
}

interface ComposerProps {
  isStreaming: boolean;
  canSend: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  /** Rendered in the composer's bottom-left toolbar (the model picker). */
  toolbar: ReactNode;
  ref?: Ref<ComposerHandle>;
}

export function Composer({ isStreaming, canSend, onSend, onStop, toolbar, ref }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    setDraft: (text) => {
      setDraft(text);
      textareaRef.current?.focus();
    },
    focus: () => textareaRef.current?.focus(),
  }));

  // Grow with content; CSS max-height caps it and turns on scrolling.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const hasText = draft.trim() !== "";
  const sendEnabled = hasText && canSend && !isStreaming;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!sendEnabled) return;
    onSend(draft);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // isComposing: don't send mid-IME (e.g. while typing Hebrew/Japanese candidates).
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-dock">
      <form className="composer" onSubmit={submit} data-streaming={isStreaming}>
        <label htmlFor="composer-input" className="visually-hidden">
          Message the agent
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          className="composer__input"
          rows={1}
          value={draft}
          placeholder="Ask about any US airport: capacity, congestion, unmet demand…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
        />

        <div className="composer__bar">
          <div className="composer__toolbar">{toolbar}</div>

          <div className="composer__right">
            <span className="composer__hint" aria-hidden="true">
              <kbd>↵</kbd> send <kbd>⇧↵</kbd> new line
            </span>
            {isStreaming ? (
              <button type="button" className="composer__send composer__send--stop" onClick={onStop} aria-label="Stop generating">
                <StopIcon size={16} />
              </button>
            ) : (
              <button type="submit" className="composer__send" disabled={!sendEnabled} aria-label="Send message">
                <ArrowUpIcon size={18} />
              </button>
            )}
          </div>
        </div>
      </form>
      <p className="composer-dock__footnote">
        Rankings come from deterministic scoring. The model only explains them. Check figures before you invest.
      </p>
    </div>
  );
}
