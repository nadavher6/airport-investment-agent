// Reads the first sheet of an .xlsx workbook into raw rows. SheetJS (`xlsx`) is a dev
// dependency: only the dataset build and its tests import this file, never the server.
import * as XLSX from "xlsx";
import type { SheetRows } from "./parse.ts";

/** Rows of the workbook's first sheet (row 0 = header). Blank cells are null. */
export function readFirstSheet(data: Uint8Array): SheetRows {
  const workbook = XLSX.read(data, { type: "array" });
  const firstName = workbook.SheetNames[0];
  const sheet = firstName === undefined ? undefined : workbook.Sheets[firstName];
  if (!sheet) throw new Error("the workbook has no sheets");
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true, blankrows: false });
}
