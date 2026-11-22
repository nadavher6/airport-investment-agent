import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "./errors.ts";

describe("errorHandler", () => {
  // Regression: once an SSE stream is open, writing a JSON error would throw ERR_HTTP_HEADERS_SENT.
  it("defers to Express when headers were already sent", () => {
    const res = { headersSent: true, status: vi.fn(), json: vi.fn() };
    const next = vi.fn();
    const err = new Error("late failure");

    errorHandler(err, {} as Request, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns a logged 500 for unexpected errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const json = vi.fn();
    const res = { headersSent: false, status: vi.fn(() => ({ json })) };

    errorHandler(new Error("boom"), {} as Request, res as unknown as Response, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: { code: "internal", message: "Unexpected server error" } });
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
