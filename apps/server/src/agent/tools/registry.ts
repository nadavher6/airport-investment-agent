import type { RegisteredTool } from "./tool.ts";
import { getAirportByCodeTool } from "./getAirportByCode.ts";
import { findAirportsByCityTool } from "./findAirportsByCity.ts";
import { findAirportsByRegionTool } from "./findAirportsByRegion.ts";
import { getEnplanementsTool } from "./getEnplanements.ts";
import { scoreAirportsTool } from "./scoreAirports.ts";

/**
 * The tool catalogue the main agent exposes. Order is the order shown in the system prompt
 * (see `renderToolsForPrompt`). All five tools implement the shared `Tool` contract.
 * Not connected to any agent, LLM client or route yet.
 */
export const TOOLS: readonly RegisteredTool[] = [
  getAirportByCodeTool,
  findAirportsByCityTool,
  findAirportsByRegionTool,
  getEnplanementsTool,
  scoreAirportsTool,
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
