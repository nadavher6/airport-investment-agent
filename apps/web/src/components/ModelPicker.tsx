import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ModelId, ModelInfo } from "@airport/shared";
import type { ModelsState } from "../hooks/useModels";
import { CheckIcon, ChevronIcon } from "./icons";
import "./ModelPicker.css";

interface ModelPickerProps {
  state: ModelsState;
  selected: ModelInfo | null;
  onSelect: (id: ModelId) => void;
  disabled?: boolean;
}

export function ModelPicker({ state, selected, onSelect, disabled = false }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const models = state.status === "ready" ? state.models : [];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const openList = () => {
    const index = models.findIndex((m) => m.id === selected?.id);
    setActiveIndex(Math.max(index, 0));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (model: ModelInfo | undefined) => {
    if (!model?.available) return;
    onSelect(model.id);
    close();
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const move = (step: number) => {
      e.preventDefault();
      setActiveIndex((i) => (i + step + models.length) % models.length);
    };
    switch (e.key) {
      case "ArrowDown":
        return move(1);
      case "ArrowUp":
        return move(-1);
      case "Home":
        e.preventDefault();
        return setActiveIndex(0);
      case "End":
        e.preventDefault();
        return setActiveIndex(models.length - 1);
      case "Enter":
      case " ":
        e.preventDefault();
        return choose(models[activeIndex]);
      case "Escape":
      case "Tab":
        e.preventDefault();
        return close();
    }
  };

  const buttonLabel =
    state.status === "loading" ? "Loading models…" : state.status === "error" ? "Models unavailable" : (selected?.label ?? "Choose model");

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="model-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled || state.status !== "ready"}
        onClick={() => (open ? close() : openList())}
      >
        {selected && <span className="provider-dot" data-provider={selected.provider} aria-hidden="true" />}
        <span className="model-picker__label">{buttonLabel}</span>
        <ChevronIcon size={14} className="model-picker__chevron" />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Model"
          aria-activedescendant={`${listId}-${activeIndex}`}
          className="model-picker__list"
          onKeyDown={onListKeyDown}
        >
          <li className="eyebrow model-picker__heading" role="presentation">
            Model
          </li>
          {models.map((model, index) => (
            <li
              key={model.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={model.id === selected?.id}
              aria-disabled={!model.available}
              data-active={index === activeIndex}
              className="model-option"
              onPointerEnter={() => setActiveIndex(index)}
              onClick={() => choose(model)}
            >
              <span className="provider-dot" data-provider={model.provider} aria-hidden="true" />
              <span className="model-option__body">
                <span className="model-option__title">
                  {model.label}
                  <span className="model-option__provider">{model.provider}</span>
                </span>
                <span className="model-option__desc">{model.description}</span>
                <span className="model-option__chips">
                  {model.capabilities.thinking && <span className="chip">Thinking</span>}
                  {model.capabilities.toolUse && <span className="chip">Tools</span>}
                  {!model.available && (
                    <span className="chip chip--muted">{model.provider === "gemini" ? "No API key" : "Not found"}</span>
                  )}
                </span>
              </span>
              <CheckIcon size={16} className="model-option__check" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
