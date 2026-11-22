import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// index.ts loads the repo-root .env (GEMINI_API_KEY). It must never be committed.
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const git = (...args: string[]): string => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });

describe("the repo-root .env file", () => {
  it("is ignored by git", () => {
    // check-ignore exits non-zero (and execFileSync throws) when the path is not ignored.
    expect(git("check-ignore", ".env").trim()).toBe(".env");
  });

  it("is not tracked", () => {
    expect(git("ls-files", "--", ".env")).toBe("");
  });
});
