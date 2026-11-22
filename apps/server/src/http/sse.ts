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

/** One SSE frame per event. The client parses `data:` lines as JSON AgentEvents. */
export function writeEvent(res: Response, event: AgentEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
