import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseCompare } from "./spec";

/**
 * The server's compare skill (#46) teaches the model a ```compare fence. Its example must be what this
 * web parser accepts, or the chat shows "Could not draw this comparison". The test reads the skill file
 * itself, so the example cannot drift from this schema.
 */
const SKILL = readFileSync(resolve(process.cwd(), "../server/src/agent/skills/compare.md"), "utf8");

describe("the server's compare skill example", () => {
  it("has exactly one compare fence, and parseCompare accepts it", () => {
    const bodies = [...SKILL.matchAll(/```compare\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? "");
    expect(bodies).toHaveLength(1);
    const result = parseCompare(bodies[0] ?? "");
    expect(result).toMatchObject({ ok: true });
    if (result.ok) {
      expect(result.spec.columns).toEqual(["LAX", "SNA"]);
      expect(result.spec.rows.every((r) => r.cells.every((c) => c.every((b) => b.kind === "markdown")))).toBe(true);
    }
  });
});
