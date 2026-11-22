import { z } from "zod";

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
  /** Characters of fence body we even try to parse. */
  body: 100_000,
} as const;

export type FenceLang = "chart" | "table" | "kpi";
export const FENCE_LANGS: readonly FenceLang[] = ["chart", "table", "kpi"];

/** z.number() already rejects NaN and ±Infinity in zod 4; the message says so. */
const finite = z.number({ error: "must be a finite number" });
const text = (max: number) => z.string().trim().min(1).max(max);
const title = text(LIMITS.title).optional();
const unit = text(LIMITS.unit).optional();

const xValue = z.union([finite, text(LIMITS.label)]);
const point = z.tuple([xValue, finite]);

const lineSeries = z.object({
  name: text(LIMITS.label),
  points: z.array(point).min(1).max(LIMITS.points),
});

export const lineSpec = z.object({
  type: z.literal("line"),
  title,
  /** The x-axis name, e.g. "year". */
  x: text(LIMITS.label).optional(),
  unit,
  series: z.array(lineSeries).min(1).max(LIMITS.series),
});

export const barSpec = z.object({
  type: z.literal("bar"),
  title,
  unit,
  items: z
    .array(z.object({ label: text(LIMITS.label), value: finite }))
    .min(1)
    .max(LIMITS.items),
  sort: z.enum(["desc", "asc", "none"]).optional(),
});

const cell = z.union([finite, z.string().max(LIMITS.cell), z.null()]);

export const tableSpec = z
  .object({
    type: z.literal("table"),
    title,
    columns: z.array(text(LIMITS.label)).min(1).max(LIMITS.columns),
    rows: z.array(z.array(cell).max(LIMITS.columns)).max(LIMITS.rows),
  })
  .superRefine((spec, ctx) => {
    spec.rows.forEach((row, i) => {
      if (row.length !== spec.columns.length) {
        ctx.addIssue({
          code: "custom",
          path: ["rows", i],
          message: `has ${row.length} cells but there are ${spec.columns.length} columns`,
        });
      }
    });
  });

export const kpiSpec = z.object({
  type: z.literal("kpi"),
  title,
  items: z
    .array(
      z.object({
        label: text(LIMITS.label),
        value: z.union([finite, text(LIMITS.label)]),
        unit,
        delta: text(LIMITS.label).optional(),
      }),
    )
    .min(1)
    .max(LIMITS.kpiItems),
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

function describe(error: z.ZodError): string {
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
  const result = visualSpec.safeParse(input);
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
