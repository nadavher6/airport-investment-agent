import type { ReactNode } from "react";

/** Draws the body of a fenced code block (for example JSON for a chart). Called once, when the fence is closed. */
export type FenceRenderer = (body: string) => ReactNode;

const renderers = new Map<string, FenceRenderer>();

/** Registers a renderer for a code fence language (for example "chart"). A second call for the same language replaces the first. */
export function registerFence(lang: string, render: FenceRenderer): void {
  renderers.set(lang, render);
}

export function getFenceRenderer(lang: string): FenceRenderer | undefined {
  return renderers.get(lang);
}

/** Test helper: forgets every registered renderer. */
export function resetFencesForTests(): void {
  renderers.clear();
}
