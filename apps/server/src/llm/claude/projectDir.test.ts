import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeProjectDirName, claudeProjectDirToRemove } from "./projectDir.ts";

const home = "/Users/someone";
const sandbox = "/private/var/folders/c6/8mgg1g5j20x2v9hm_ngmx9w00000gn/T/airport-claude-2SSRep";
const real = "-private-var-folders-c6-8mgg1g5j20x2v9hm-ngmx9w00000gn-T-airport-claude-2SSRep";

describe("claudeProjectDirName", () => {
  it("matches the name Claude Code really gave a sandbox dir (every non-alphanumeric becomes -)", () => {
    expect(claudeProjectDirName(sandbox)).toBe(real);
    expect(claudeProjectDirName("/tmp/a.b_c d/airport-claude-x")).toBe("-tmp-a-b-c-d-airport-claude-x");
  });
});

describe("claudeProjectDirToRemove", () => {
  it("is exactly <home>/.claude/projects/<name> for one of our sandboxes", () => {
    expect(claudeProjectDirToRemove(home, sandbox)).toBe(`/Users/someone/.claude/projects/${real}`);
  });

  it("refuses anything that is not one of our sandbox dirs", () => {
    expect(claudeProjectDirToRemove(home, "/Users/someone/code/project")).toBeUndefined();
    expect(claudeProjectDirToRemove(home, "/")).toBeUndefined();
    expect(claudeProjectDirToRemove(home, "/tmp/airport-claude-x/..")).toBeUndefined();
    expect(claudeProjectDirToRemove(home, "relative/airport-claude-x")).toBeUndefined();
  });

  it("refuses a relative home and names Claude Code would have shortened", () => {
    expect(claudeProjectDirToRemove("someone", sandbox)).toBeUndefined();
    expect(claudeProjectDirToRemove(home, `/${"d".repeat(220)}/airport-claude-x`)).toBeUndefined();
  });
});

describe("claudeProjectDirToRemove with CLAUDE_CONFIG_DIR", () => {
  it("uses <configDir>/projects instead of <home>/.claude/projects, still the exact dir", () => {
    const configDir = mkdtempSync(join(tmpdir(), "fake-config-"));
    try {
      expect(claudeProjectDirToRemove(home, sandbox, configDir)).toBe(join(configDir, "projects", real));
      expect(claudeProjectDirToRemove(home, sandbox, "relative/config")).toBeUndefined();
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });
});
