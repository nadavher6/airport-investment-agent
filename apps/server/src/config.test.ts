import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("uses defaults when the environment is empty", () => {
    const config = loadConfig({});
    expect(config.port).toBe(8787);
    expect(config.version).toBe(packageJson.version);
    expect(config.configuredProviders.size).toBe(0);
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

  it("detects which providers have API keys (empty values don't count)", () => {
    const config = loadConfig({ GEMINI_API_KEY: "k1", GROQ_API_KEY: "", OPENROUTER_API_KEY: "k3" });
    expect([...config.configuredProviders].sort()).toEqual(["gemini", "openrouter"]);
  });

  it("ignores API keys that are only whitespace", () => {
    const config = loadConfig({ GEMINI_API_KEY: "  ", GROQ_API_KEY: "\n", OPENROUTER_API_KEY: " k3 " });
    expect([...config.configuredProviders]).toEqual(["openrouter"]);
  });

  it("defaults the Claude settings: claude on PATH, no model, 2 at once", () => {
    expect(loadConfig({ PATH: "/usr/bin" }).claude).toEqual({
      bin: undefined,
      searchPath: "/usr/bin",
      model: undefined,
      maxConcurrent: 2,
    });
  });

  it("reads CLAUDE_BIN, CLAUDE_MODEL and CLAUDE_MAX_CONCURRENT", () => {
    const { claude } = loadConfig({ CLAUDE_BIN: " /opt/claude ", CLAUDE_MODEL: "sonnet", CLAUDE_MAX_CONCURRENT: "4" });
    expect(claude).toMatchObject({ bin: "/opt/claude", model: "sonnet", maxConcurrent: 4 });
  });

  it.each(["0", "-1", "two", "1.5"])("rejects invalid CLAUDE_MAX_CONCURRENT %s", (value) => {
    expect(() => loadConfig({ CLAUDE_MAX_CONCURRENT: value })).toThrow(/Invalid CLAUDE_MAX_CONCURRENT/);
  });
});
