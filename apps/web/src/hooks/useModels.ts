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
        const isUsable = (id: string | null) => models.some((m) => m.id === id && m.available);
        setSelectedId(isUsable(stored) ? (stored as ModelId) : defaultModelId);
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

  return { state, selected, select };
}
