import type { RegisteredTool } from "./tool.ts";
import { getAirportByCodeTool } from "./getAirportByCode.ts";
import { findAirportsByCityTool } from "./findAirportsByCity.ts";
import { findAirportsByRegionTool } from "./findAirportsByRegion.ts";
import { getEnplanementsTool } from "./getEnplanements.ts";

/**
 * The tool catalogue the main agent exposes. Order is the order shown in the system prompt
 * (see `renderToolsForPrompt`). All four tools implement the shared `Tool` contract.
 */
export const ALL_TOOLS: readonly RegisteredTool[] = [
  getAirportByCodeTool,
  findAirportsByCityTool,
  findAirportsByRegionTool,
  getEnplanementsTool,
];

/** Look up a tool by the name the model calls (from a tool_call event). */
export const toolsByName: ReadonlyMap<string, RegisteredTool> = new Map(ALL_TOOLS.map((t) => [t.name, t]));
