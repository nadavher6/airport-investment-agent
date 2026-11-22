// zod/mini: the same validator with a tree-shakable API (wired-in JS +12 kB gzip instead of +30 kB).
import { z } from "zod/mini";

/**
 * The visual specs the model writes inside ```chart / ```table / ```kpi fences.
 * Every limit here keeps one bad answer from freezing the page or flooding the thread.
 */
export const LIMITS = {
  series: 8,
  points: 50,
  items: 50,
  kpiItems: 12,
  columns: 20,
  rows: 200,
  title: 120,
  label: 60,
  unit: 30,
  cell: 200,
  /** Largest |number| accepted: keeps axis maths exact and ticks bounded. */
  magnitude: 1e15,
  /** Characters of fence body we even try to parse. */
  body: 100_000,
} as const;

export type FenceLang = "chart" | "table" | "kpi";
export const FENCE_LANGS: readonly FenceLang[] = ["chart", "table", "kpi"];

/** z.number() already rejects NaN and ±Infinity in zod 4; the message says so. */
const finite = z.number({ error: "must be a finite number" }).check(
  z.gte(-LIMITS.magnitude, { error: `must be at least -${LIMITS.magnitude}` }),
  z.lte(LIMITS.magnitude, { error: `must be at most ${LIMITS.magnitude}` }),
);
const text = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));
const list = <T extends z.core.SomeType>(item: T, max: number, min = 1) =>
  z.array(item).check(z.minLength(min), z.maxLength(max));
const title = z.optional(text(LIMITS.title));
const unit = z.optional(text(LIMITS.unit));

const xValue = z.union([finite, text(LIMITS.label)]);
const point = z.tuple([xValue, finite]);

const lineSeries = z.object({
  name: text(LIMITS.label),
  points: list(point, LIMITS.points).check(
    z.refine((pts) => new Set(pts.map((p) => p[0])).size === pts.length, { error: "has duplicate x values" }),
  ),
});

export const lineSpec = z.object({
  type: z.literal("line"),
  title,
  /** The x-axis name, e.g. "year". */
  x: z.optional(text(LIMITS.label)),
  unit,
  series: list(lineSeries, LIMITS.series),
});

export const barSpec = z.object({
  type: z.literal("bar"),
  title,
  unit,
  items: list(z.object({ label: text(LIMITS.label), value: finite }), LIMITS.items),
  sort: z.optional(z.enum(["desc", "asc", "none"])),
});

const cell = z.union([finite, z.string().check(z.maxLength(LIMITS.cell)), z.null()]);

export const tableSpec = z
  .object({
    type: z.literal("table"),
    title,
    columns: list(text(LIMITS.label), LIMITS.columns),
    rows: list(list(cell, LIMITS.columns, 0), LIMITS.rows, 0),
  })
  .check(
    z.superRefine((spec, ctx) => {
      spec.rows.forEach((row, i) => {
        if (row.length !== spec.columns.length) {
          ctx.addIssue({
            code: "custom",
            path: ["rows", i],
            message: `has ${row.length} cells but there are ${spec.columns.length} columns`,
          });
        }
      });
    }),
  );

export const kpiSpec = z.object({
  type: z.literal("kpi"),
  title,
  items: list(
    z.object({
      label: text(LIMITS.label),
      value: z.union([finite, text(LIMITS.label)]),
      unit,
      delta: z.optional(text(LIMITS.label)),
    }),
    LIMITS.kpiItems,
  ),
});

export const visualSpec = z.discriminatedUnion("type", [lineSpec, barSpec, tableSpec, kpiSpec]);

export type LineSpec = z.infer<typeof lineSpec>;
export type BarSpec = z.infer<typeof barSpec>;
export type TableSpec = z.infer<typeof tableSpec>;
export type KpiSpec = z.infer<typeof kpiSpec>;
export type VisualSpec = z.infer<typeof visualSpec>;
export type Cell = z.infer<typeof cell>;

export type ParseResult =
  | { ok: true; spec: VisualSpec }
  /** `json` is set when the body was valid JSON, so the fallback can try to coerce it. */
  | { ok: false; reason: string; json?: unknown };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function describe(error: z.core.$ZodError): string {
  const first = error.issues[0];
  if (!first) return "the spec is not valid";
  const where = first.path.length > 0 ? first.path.join(".") : "spec";
  return `${where}: ${first.message}`;
}

/** Checks a parsed value against the spec the fence language implies. Never throws. */
export function validateSpec(lang: FenceLang, value: unknown): ParseResult {
  if (!isRecord(value)) return { ok: false, reason: "the spec must be a JSON object", json: value };
  // ```table and ```kpi fences name their type by the fence; ```chart carries it in `type`.
  const input = lang === "chart" ? value : { ...value, type: value.type ?? lang };
  if (lang === "chart" && input.type !== "line" && input.type !== "bar") {
    return { ok: false, reason: 'a chart needs "type": "line" or "bar"', json: value };
  }
  const result = z.safeParse(visualSpec, input);
  return result.success ? { ok: true, spec: result.data } : { ok: false, reason: describe(result.error), json: value };
}

/** Parses a fence body (JSON text) into a checked spec. Never throws. */
export function parseVisual(lang: FenceLang, body: string): ParseResult {
  if (body.length > LIMITS.body) return { ok: false, reason: `the spec is longer than ${LIMITS.body} characters` };
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, reason: "the spec is not valid JSON" };
  }
  return validateSpec(lang, json);
}
