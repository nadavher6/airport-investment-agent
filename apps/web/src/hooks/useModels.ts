import { useEffect, useState } from "react";
import type { ModelId, ModelInfo } from "@airport/shared";
import { api } from "../api/client";
import { readStorage, writeStorage } from "../lib/storage";

const STORAGE_KEY = "runway.model";

export type ModelsState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly models: readonly ModelInfo[] };

export function useModels() {
  const [state, setState] = useState<ModelsState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<ModelId | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .models(controller.signal)
      .then(({ models, defaultModelId }) => {
        const stored = readStorage(STORAGE_KEY);
        const usable = (id: string | null) => models.find((m) => m.id === id && m.available)?.id;
        // The server's default may lack an API key; then any available model beats one that always 503s.
        setSelectedId(usable(stored) ?? usable(defaultModelId) ?? models.find((m) => m.available)?.id ?? null);
        setState({ status: "ready", models });
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load models" });
        }
      });
    return () => controller.abort();
  }, []);

  const select = (id: ModelId) => {
    setSelectedId(id);
    writeStorage(STORAGE_KEY, id);
  };

  const selected = state.status === "ready" ? (state.models.find((m) => m.id === selectedId) ?? null) : null;

  const noneAvailable = state.status === "ready" && !state.models.some((m) => m.available);

  return { state, selected, select, noneAvailable };
}
