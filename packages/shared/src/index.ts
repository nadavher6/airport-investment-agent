export * from "./ids.ts";
export type * from "./json.ts";
export type * from "./models.ts";
export type * from "./chat.ts";
export type * from "./events.ts";
export type * from "./errors.ts";
export * from "./api.ts";
export * from "./limits.ts";

/** Compile-time exhaustiveness check for discriminated-union switches. */
export function assertNever(value: never, context = "value"): never {
  throw new Error(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
