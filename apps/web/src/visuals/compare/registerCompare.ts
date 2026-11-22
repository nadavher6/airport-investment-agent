import { registerFence } from "../../components/markdown/fences";
import type { RegisterFence } from "../registerVisuals";
import { renderCompare } from "./Compare";

export const COMPARE_FENCE = "compare";

/** Registers the ```compare renderer. Call once at start-up, next to registerVisuals(). */
export function registerCompare(register: RegisterFence = registerFence): void {
  register(COMPARE_FENCE, renderCompare);
}
