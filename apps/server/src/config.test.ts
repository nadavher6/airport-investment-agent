import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("uses defaults when the environment is empty", () => {
    const config = loadConfig({});
    expect(config.port).toBe(8787);
    expect(config.version).toBe("0.0.0");
    expect(config.configuredProviders.size).toBe(0);
  });

  it("reads PORT and the package version", () => {
    const config = loadConfig({ PORT: "9000", npm_package_version: "1.2.3" });
    expect(config.port).toBe(9000);
    expect(config.version).toBe("1.2.3");
  });

  it.each(["abc", "0", "70000", "80.5"])("rejects invalid PORT %s", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(/Invalid PORT/);
  });

  it("detects which providers have API keys (empty values don't count)", () => {
    const config = loadConfig({ GEMINI_API_KEY: "k1", GROQ_API_KEY: "", OPENROUTER_API_KEY: "k3" });
    expect([...config.configuredProviders].sort()).toEqual(["gemini", "openrouter"]);
  });
});
