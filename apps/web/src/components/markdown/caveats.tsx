import type { ReactNode } from "react";
import { registerFence, type FenceRenderer } from "./fences";

/** The fence language the server uses for a final answer's caveats (#63): one caveat per line, "- " optional. */
export const CAVEATS_FENCE = "caveats";

/** Draws a ```caveats fence as a small muted list. Plain text only (no Markdown inside). */
export const renderCaveats: FenceRenderer = (body: string): ReactNode => {
  const items = body
    .split("\n")
    .map((line) => line.replace(/^\s*[-*]\s+/, "").trim())
    .filter((line) => line !== "");
  if (items.length === 0) return null;
  return (
    <ul className="md-caveats" aria-label="Caveats">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
};

/** Registers the ```caveats renderer. Call once at start-up. */
export function registerCaveats(register: (lang: string, render: FenceRenderer) => void = registerFence): void {
  register(CAVEATS_FENCE, renderCaveats);
}
