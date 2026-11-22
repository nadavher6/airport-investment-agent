import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("uses defaults when the environment is empty", () => {
    const config = loadConfig({});
    expect(config.port).toBe(8787);
    expect(config.version).toBe(packageJson.version);
    expect(config.gemini.apiKey).toBeUndefined();
  });

  it("reads PORT", () => {
    expect(loadConfig({ PORT: "9000" }).port).toBe(9000);
  });

  // Regression: npm_package_version is unset when started with `tsx src/index.ts` directly.
  it("takes the version from package.json, not npm_package_version", () => {
    expect(loadConfig({ npm_package_version: "1.2.3" }).version).toBe(packageJson.version);
  });

  it.each(["abc", "0", "70000", "80.5"])("rejects invalid PORT %s", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });

  it("reads GEMINI_API_KEY trimmed", () => {
    expect(loadConfig({ GEMINI_API_KEY: " test-key " }).gemini.apiKey).toBe("test-key");
  });

  it.each(["", "  ", "\n"])("treats a blank GEMINI_API_KEY (%j) as unset", (key) => {
    expect(loadConfig({ GEMINI_API_KEY: key }).gemini.apiKey).toBeUndefined();
  });

  it("defaults the Claude settings: claude on PATH, no model", () => {
    expect(loadConfig({ PATH: "/usr/bin" }).claude).toEqual({ bin: undefined, searchPath: "/usr/bin", model: undefined });
  });

  it("reads CLAUDE_BIN and CLAUDE_MODEL", () => {
    const { claude } = loadConfig({ CLAUDE_BIN: " /opt/claude ", CLAUDE_MODEL: "sonnet" });
    expect(claude).toMatchObject({ bin: "/opt/claude", model: "sonnet" });
  });
});
