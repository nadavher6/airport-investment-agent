/** Values that survive JSON.stringify -> JSON.parse unchanged. Used for tool inputs/outputs. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
