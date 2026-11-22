/**
 * TEMPORARY STUB of the fence registry that #32 owns (apps/web/src/components/markdown/).
 * Same signatures as #32's interface. Once #32 is on main: point registerVisuals.ts at
 * #32's module and delete this file. Nothing else imports it.
 */
import type { ReactNode } from "react";

export type FenceRenderer = (body: string) => ReactNode;

const registry = new Map<string, FenceRenderer>();

export function registerFence(lang: string, render: FenceRenderer): void {
  registry.set(lang, render);
}

export function getFenceRenderer(lang: string): FenceRenderer | undefined {
  return registry.get(lang);
}
