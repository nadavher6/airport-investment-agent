// The one line to change once #32 merges: import from #32's registry and delete the stub.
import { registerFence, type FenceRenderer } from "./fenceRegistryStub";
import { FENCE_LANGS } from "./spec";
import { renderVisual } from "./Visual";

export type RegisterFence = (lang: string, render: FenceRenderer) => void;

/** Registers the ```chart, ```table and ```kpi renderers. Call once at start-up. */
export function registerVisuals(register: RegisterFence = registerFence): void {
  for (const lang of FENCE_LANGS) register(lang, renderVisual(lang));
}
