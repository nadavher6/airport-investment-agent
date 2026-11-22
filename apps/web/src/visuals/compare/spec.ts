import { z } from "zod/mini";
import { LIMITS, validateSpec, type FenceLang, type ParseResult } from "../spec";

/**
 * The ```compare fence: airports side by side, with sections lined up across the columns.
 * The structure is checked here; each chart/table/kpi block's `spec` is checked with #33's own
 * validator (validateSpec) when it is drawn, so one bad block falls back alone.
 */
export const COMPARE_LIMITS = {
  /** Exactly 2 for now. Raise `maxColumns` to allow 3 later; the rest of the code follows columns.length. */
  minColumns: 2,
  maxColumns: 2,
  rows: 12,
  blocksPerCell: 6,
  /** Characters of markdown in one block. */
  markdown: 2000,
} as const;

const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));

const markdownBlock = z.object({
  kind: z.literal("markdown"),
  text: z.string().check(z.maxLength(COMPARE_LIMITS.markdown)),
});

/** The #33 spec, unchecked here: validateSpec decides per block, with #33's limits. */
const visualBlock = (kind: FenceLang) =>
  z.object({ kind: z.literal(kind), spec: z.record(z.string(), z.unknown()) });

export const compareBlock = z.discriminatedUnion("kind", [
  markdownBlock,
  visualBlock("chart"),
  visualBlock("table"),
  visualBlock("kpi"),
]);

const cell = z.array(compareBlock).check(z.maxLength(COMPARE_LIMITS.blocksPerCell));

const row = z.object({
  label: text(LIMITS.label),
  cells: z.array(cell),
});

export const compareSpec = z
  .object({
    title: z.optional(text(LIMITS.title)),
    columns: z
      .array(text(LIMITS.label))
      .check(z.minLength(COMPARE_LIMITS.minColumns), z.maxLength(COMPARE_LIMITS.maxColumns)),
    rows: z.array(row).check(z.minLength(1), z.maxLength(COMPARE_LIMITS.rows)),
  })
  .check(
    z.superRefine((spec, ctx) => {
      spec.rows.forEach((r, i) => {
        if (r.cells.length !== spec.columns.length) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", i, "cells"],
            message: `has ${r.cells.length} cells but there are ${spec.columns.length} columns`,
          });
        }
      });
    }),
  );

export type CompareBlock = z.infer<typeof compareBlock>;
export type CompareSpec = z.infer<typeof compareSpec>;

export type CompareParseResult = { ok: true; spec: CompareSpec } | { ok: false; reason: string };

function describe(error: z.core.$ZodError): string {
  const first = error.issues[0];
  if (!first) return "the spec is not valid";
  const where = first.path.length > 0 ? first.path.join(".") : "spec";
  return `${where}: ${first.message}`;
}

/** Checks a parsed value against the compare spec. Never throws. */
export function validateCompare(value: unknown): CompareParseResult {
  const result = z.safeParse(compareSpec, value);
  return result.success ? { ok: true, spec: result.data } : { ok: false, reason: describe(result.error) };
}

/** Parses a ```compare fence body. Never throws. */
export function parseCompare(body: string): CompareParseResult {
  if (body.length > LIMITS.body) return { ok: false, reason: `the spec is longer than ${LIMITS.body} characters` };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, reason: "the spec is not valid JSON" };
  }
  return validateCompare(json);
}

/** Checks one chart/table/kpi block with #33's validator and limits. */
export function validateBlock(block: Exclude<CompareBlock, { kind: "markdown" }>): ParseResult {
  return validateSpec(block.kind, block.spec);
}
