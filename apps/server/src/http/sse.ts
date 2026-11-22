import type { Response } from "express";
import { CHAT_STREAM_CONTENT_TYPE, type AgentEvent } from "@airport/shared";

export function openEventStream(res: Response): void {
  res.status(200);
  res.setHeader("Content-Type", `${CHAT_STREAM_CONTENT_TYPE}; charset=utf-8`);
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Stops proxies (nginx etc.) from buffering the stream.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

/**
 * One SSE frame per event. The client parses `data:` lines as JSON AgentEvents.
 * Returns false when the socket buffer is full and the caller should wait for "drain".
 */
export function writeEvent(res: Response, event: AgentEvent): boolean {
  return res.write(`data: ${JSON.stringify(event)}\n\n`);
}
