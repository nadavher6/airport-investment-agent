import type { RegisteredTool } from "./tool.ts";
import { getAirportByCodeTool } from "./getAirportByCode.ts";
import { findAirportsByCityTool } from "./findAirportsByCity.ts";
import { findAirportsByRegionTool } from "./findAirportsByRegion.ts";
import { getEnplanementsTool } from "./getEnplanements.ts";
import { listHubsTool } from "./listHubs.ts";
import { scoreAirportsTool } from "./scoreAirports.ts";
import { CATEGORY_TOOLS } from "./categoryTools.ts";

/**
 * The tool catalogue the main agent exposes. Order is the order shown in the system prompt
 * (see `renderToolsForPrompt`). Every tool implements the shared `Tool` contract; the four per-category
 * tools (#61) follow score_airports.
 * Not connected to any agent, LLM client or route yet.
 */
export const TOOLS: readonly RegisteredTool[] = [
  getAirportByCodeTool,
  findAirportsByCityTool,
  findAirportsByRegionTool,
  getEnplanementsTool,
  listHubsTool,
  scoreAirportsTool,
  ...CATEGORY_TOOLS,
];

/** Index by name; a duplicate name is a programming error, so it fails at load time. */
function indexByName(tools: readonly RegisteredTool[]): ReadonlyMap<string, RegisteredTool> {
  const byName = new Map<string, RegisteredTool>();
  for (const tool of tools) {
    if (byName.has(tool.name)) throw new Error(`Duplicate tool name: ${tool.name}`);
    byName.set(tool.name, tool);
  }
  return byName;
}

const TOOLS_BY_NAME = indexByName(TOOLS);

/** The tool the model called by name (from a tool_call event), or undefined for an unknown name. */
export function getTool(name: string): RegisteredTool | undefined {
  return TOOLS_BY_NAME.get(name);
}
