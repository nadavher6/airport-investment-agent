import { readFileSync } from "node:fs";

/**
 * The grading skill (#43): the owner's description of what is graded and how, plus the formula
 * and weights. Loaded once at start-up and put in the system context of a `grading` turn.
 */
export const GRADING_SKILL: string = readFileSync(new URL("./grading.md", import.meta.url), "utf8");

/** The KPI keys of the scoring code, in the order the skill's four categories appear. */
export const GRADING_SKILL_KPI_KEYS = ["congestion", "unmet_demand", "long_haul", "growth"] as const;

/** How each KPI is named in the skill's formula line ("0.30·Congestion"). */
const FORMULA_NAME: Readonly<Record<(typeof GRADING_SKILL_KPI_KEYS)[number], string>> = {
  congestion: "Congestion",
  unmet_demand: "Unmet demand",
  long_haul: "Long-haul",
  growth: "Growth",
};

/** The part of a scoring KPI definition the skill must agree with (`INVESTMENT_KPIS` entries fit it). */
export interface KpiFacts {
  readonly key: string;
  readonly weight: number;
  /** The KPI's assumption note: names its data source ("BTS T-100" or "FAA"). */
  readonly note?: string;
}

/** The "**Status:**" lines of the skill, in category order. */
export function gradingStatusLines(skill: string): string[] {
  return skill
    .split("\n")
    .filter((line) => line.trim().startsWith("- **Status:**"))
    .map((line) => line.trim().slice("- **Status:**".length).trim());
}

const sourceOf = (text: string): "BTS T-100" | "FAA" | undefined =>
  text.includes("BTS T-100") ? "BTS T-100" : text.includes("FAA") ? "FAA" : undefined;

/**
 * Everything in the skill that contradicts the scoring code's KPI list: a category the code does
 * not compute (or the reverse), a Status line that does not say "computed", a different data
 * source, or a different weight in the formula line. Empty when they agree.
 */
export function kpiStatusMismatches(skill: string, kpis: readonly KpiFacts[]): string[] {
  const problems: string[] = [];
  const statuses = gradingStatusLines(skill);
  const keys = kpis.map((k) => k.key);
  if (JSON.stringify(keys) !== JSON.stringify(GRADING_SKILL_KPI_KEYS)) {
    problems.push(`the code's KPIs are [${keys.join(", ")}], the skill describes [${GRADING_SKILL_KPI_KEYS.join(", ")}]`);
  }
  for (const stale of ["not computed", "v0 shortcut", "airport size"]) {
    if (skill.includes(stale)) problems.push(`the skill still says "${stale}", but the code computes every KPI`);
  }
  if (statuses.length !== GRADING_SKILL_KPI_KEYS.length) {
    problems.push(`the skill has ${statuses.length} Status lines, expected ${GRADING_SKILL_KPI_KEYS.length}`);
  }
  GRADING_SKILL_KPI_KEYS.forEach((key, i) => {
    const status = statuses[i] ?? "";
    const kpi = kpis.find((k) => k.key === key);
    if (kpi === undefined) return;
    if (!status.startsWith("computed")) problems.push(`${key}: the code computes it, the skill's Status says "${status}"`);
    const codeSource = sourceOf(kpi.note ?? "");
    if (codeSource !== undefined && sourceOf(status) !== codeSource) {
      problems.push(`${key}: the code uses ${codeSource}, the skill's Status does not say so`);
    }
    const weight = `${kpi.weight.toFixed(2)}·${FORMULA_NAME[key]}`;
    if (!skill.includes(weight)) problems.push(`${key}: the formula line does not contain "${weight}"`);
  });
  return problems;
}
