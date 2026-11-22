import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fakeClaude, type FakeClaude } from "../../test/fakeClaude.ts";
import { testConfig } from "../../test/helpers.ts";
import { findClaudeBinary } from "./binary.ts";

let fake: FakeClaude;
afterEach(() => fake?.cleanup());

const claudeConfig = (overrides: Parameters<typeof testConfig>[1]) => testConfig([], overrides).claude;

describe("findClaudeBinary", () => {
  it("finds `claude` on the search PATH", () => {
    fake = fakeClaude();
    const empty = mkdtempSync(join(tmpdir(), "empty-"));
    expect(findClaudeBinary(claudeConfig({ searchPath: [empty, fake.dir].join(delimiter) }))).toBe(fake.bin);
  });

  it("uses CLAUDE_BIN when it is a path", () => {
    fake = fakeClaude();
    expect(findClaudeBinary(claudeConfig({ bin: fake.bin }))).toBe(fake.bin);
  });

  it("returns undefined when nothing is found or the file is not executable", () => {
    expect(findClaudeBinary(claudeConfig({ searchPath: "" }))).toBeUndefined();
    expect(findClaudeBinary(claudeConfig({ bin: "/nope/claude" }))).toBeUndefined();
    const dir = mkdtempSync(join(tmpdir(), "noexec-"));
    writeFileSync(join(dir, "claude"), "not executable");
    expect(findClaudeBinary(claudeConfig({ searchPath: dir }))).toBeUndefined();
  });
});
