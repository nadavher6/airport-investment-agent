import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const serverDir = fileURLToPath(new URL("..", import.meta.url));

/** Runs the real entry point (src/index.ts) and resolves with its exit code and stderr. */
async function runEntryPoint(env: NodeJS.ProcessEnv): Promise<{ code: number | null; stderr: string }> {
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: serverDir,
    env: { ...process.env, ...env },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  const timer = setTimeout(() => child.kill(), 8000);
  try {
    const [code] = (await once(child, "exit")) as [number | null];
    return { code, stderr };
  } finally {
    clearTimeout(timer);
  }
}

describe("server entry point", () => {
  // Regression (PR #1 bug c): Express 5 calls the listen callback with the error, which used to log "listening".
  it("exits with code 1 and says why when the port is already in use", { timeout: 10_000 }, async () => {
    const blocker = createServer().listen(0); // same (all-interfaces) binding as app.listen(port)
    await once(blocker, "listening");
    try {
      const { port } = blocker.address() as AddressInfo;
      const { code, stderr } = await runEntryPoint({ PORT: String(port) });
      expect(code).toBe(1);
      expect(stderr).toContain(`Failed to listen on port ${port}`);
    } finally {
      blocker.close();
    }
  });
});
