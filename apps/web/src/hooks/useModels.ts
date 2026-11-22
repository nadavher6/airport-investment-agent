import { useEffect, useRef, useState } from "react";
import type { ModelId, ModelInfo, ModelProvider } from "@airport/shared";
import { api } from "../api/client";
import { readStorage, writeStorage } from "../lib/storage";

const STORAGE_KEY = "runway.model";

/** Providers whose models must pass a health check before we switch to them. */
const CHECKED_PROVIDERS: ReadonlySet<ModelProvider> = new Set(["claude-headless"]);

export type ModelsState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly models: readonly ModelInfo[] };

/** The health check run when switching to a checked provider (claude-headless). */
export type ModelCheck =
  | { readonly status: "idle" }
  | { readonly status: "checking"; readonly model: ModelInfo }
  | { readonly status: "connected"; readonly model: ModelInfo; readonly detail: string }
  | { readonly status: "failed"; readonly model: ModelInfo; readonly message: string };

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "The health check failed");

export function useModels() {
  const [state, setState] = useState<ModelsState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<ModelId | null>(null);
  const [check, setCheck] = useState<ModelCheck>({ status: "idle" });
  const checkController = useRef<AbortController | null>(null);

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
    return () => {
      controller.abort();
      checkController.current?.abort();
    };
  }, []);

  const commit = (id: ModelId) => {
    setSelectedId(id);
    writeStorage(STORAGE_KEY, id);
  };

  /**
   * Switching to a checked provider shows it as selected while its health check runs.
   * On success it stays and is saved; on failure the previous model comes back with a message.
   */
  const select = (id: ModelId) => {
    checkController.current?.abort();
    const model = state.status === "ready" ? state.models.find((m) => m.id === id) : undefined;
    if (!model || !CHECKED_PROVIDERS.has(model.provider)) {
      setCheck({ status: "idle" });
      commit(id);
      return;
    }

    const previousId = selectedId;
    const controller = new AbortController();
    checkController.current = controller;
    setSelectedId(id);
    setCheck({ status: "checking", model });
    const fail = (message: string) => {
      setSelectedId(previousId);
      setCheck({ status: "failed", model, message });
    };
    api
      .providerHealth(model.provider, controller.signal)
      .then((health) => {
        if (controller.signal.aborted) return;
        if (health.status === "ok") {
          commit(id);
          setCheck({ status: "connected", model, detail: health.detail });
        } else {
          fail(health.detail);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) fail(errorMessage(err));
      });
  };

  const selected = state.status === "ready" ? (state.models.find((m) => m.id === selectedId) ?? null) : null;

  const noneAvailable = state.status === "ready" && !state.models.some((m) => m.available);

  return { state, selected, select, check, noneAvailable };
}
