import ExcelJS from "exceljs";
import { listZipEntries } from "./zip";
import { IssueList, showValue } from "../issues";
import { IMPORT_LIMITS } from "../config";

export type Cell = string | number | boolean | Date | null;
export type SheetRow = { row: number; values: Record<string, Cell> };
export type Sheet = { name: string; headers: string[]; rows: SheetRow[] };
export type Workbook = Map<string, Sheet>;

/** Checks file size, archive structure, macros and external links before parsing. */
export function precheckXlsx(buf: Uint8Array, filename: string, issues: IssueList): boolean {
  if (!/\.xlsx$/i.test(filename)) { issues.error("file.extension", { value: filename }); return false; }
  if (buf.length > IMPORT_LIMITS.maxFileBytes) {
    issues.error("file.too_large", { params: { max: IMPORT_LIMITS.maxFileBytes / 1024 / 1024 } });
    return false;
  }
  const entries = listZipEntries(buf);
  if (!entries) { issues.error("file.not_xlsx"); return false; }
  const total = entries.reduce((s, e) => s + e.uncompressedSize, 0);
  if (total > IMPORT_LIMITS.maxUncompressedBytes) {
    issues.error("file.uncompressed_too_large", { params: { max: IMPORT_LIMITS.maxUncompressedBytes / 1024 / 1024 } });
    return false;
  }
  if (entries.some((e) => /vbaProject\.bin$/i.test(e.name))) { issues.error("file.macros"); return false; }
  if (entries.some((e) => /^xl\/externalLinks\//i.test(e.name))) { issues.error("file.external_links"); return false; }
  if (!entries.some((e) => e.name === "xl/workbook.xml")) { issues.error("file.not_xlsx"); return false; }
  return true;
}

function cellValue(v: ExcelJS.CellValue, issues: IssueList, sheet: string, row: number, field: string): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() === "" ? null : v;
  if (typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("formula" in v || "sharedFormula" in v) {
      issues.error("cell.formula", { sheet, row, field });
      return null;
    }
    if ("error" in v) { issues.error("cell.error", { sheet, row, field, value: showValue(v.error) }); return null; }
    if ("richText" in v) return v.richText.map((r) => r.text).join("") || null;
    if ("text" in v) {
      const t = (v as { text: unknown }).text;
      return typeof t === "string" ? (t.trim() === "" ? null : t) : null;
    }
  }
  return String(v);
}

export async function readWorkbook(buf: Uint8Array, issues: IssueList): Promise<Workbook | null> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    issues.error("file.not_xlsx");
    return null;
  }
  const out: Workbook = new Map();
  let cells = 0;
  wb.eachSheet((ws) => {
    if (ws.model.merges && ws.model.merges.length > 0) issues.error("sheet.merged_cells", { sheet: ws.name });
    cells += ws.rowCount * ws.columnCount;
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    const colIndex: { col: number; name: string }[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
      const name = String(cell.text ?? "").trim();
      if (name) { headers.push(name); colIndex.push({ col, name }); }
    });
    const rows: SheetRow[] = [];
    if (cells <= IMPORT_LIMITS.maxCells) {
      ws.eachRow({ includeEmpty: false }, (r, rowNumber) => {
        if (rowNumber === 1) return;
        const values: Record<string, Cell> = {};
        let any = false;
        for (const { col, name } of colIndex) {
          const v = cellValue(r.getCell(col).value, issues, ws.name, rowNumber, name);
          values[name] = v;
          if (v !== null) any = true;
        }
        if (any) rows.push({ row: rowNumber, values });
      });
    }
    out.set(ws.name, { name: ws.name, headers, rows });
  });
  if (cells > IMPORT_LIMITS.maxCells) {
    issues.error("file.too_many_cells", { params: { max: IMPORT_LIMITS.maxCells } });
    return null;
  }
  return out;
}

/* ---------- typed cell parsers shared by SEO and GEO contracts ---------- */

export type FieldCtx = { issues: IssueList; sheet: string; row: number };

export function reqText(v: Cell, field: string, c: FieldCtx): string | null {
  if (v === null) { c.issues.error("field.required", { sheet: c.sheet, row: c.row, field }); return null; }
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  if (!s) { c.issues.error("field.required", { sheet: c.sheet, row: c.row, field }); return null; }
  return s;
}

export function optText(v: Cell): string | null {
  if (v === null) return null;
  const s = (v instanceof Date ? v.toISOString() : String(v)).trim();
  return s || null;
}

export function parseInteger(v: Cell, field: string, c: FieldCtx, opts: { min: number; required: boolean }): number | null {
  if (v === null) {
    if (opts.required) c.issues.error("field.required", { sheet: c.sheet, row: c.row, field });
    return null;
  }
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*-?\d+(\.0+)?\s*$/.test(v) ? Number(v) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < opts.min) {
    c.issues.error(opts.min >= 1 ? "field.int_positive" : "field.int_min", {
      sheet: c.sheet, row: c.row, field, value: showValue(v), params: { min: opts.min },
    });
    return null;
  }
  return n;
}

export function parseDecimal(v: Cell, field: string, c: FieldCtx): number | null {
  if (v === null) return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim().replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < 0) {
    c.issues.error("field.decimal", { sheet: c.sheet, row: c.row, field, value: showValue(v) });
    return null;
  }
  return n;
}

const TRUE = new Set(["true", "1", "yes", "vrai", "oui", "ja", "waar"]);
const FALSE = new Set(["false", "0", "no", "faux", "non", "nee", "onwaar"]);

export function parseBool(v: Cell, field: string, c: FieldCtx, required = true): boolean | null {
  if (v === null) {
    if (required) c.issues.error("field.bool", { sheet: c.sheet, row: c.row, field, value: "" });
    return null;
  }
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (TRUE.has(s)) return true;
  if (FALSE.has(s)) return false;
  c.issues.error("field.bool", { sheet: c.sheet, row: c.row, field, value: showValue(v) });
  return null;
}

export function parseIsoDate(v: Cell, field: string, c: FieldCtx): string | null {
  if (v === null) { c.issues.error("field.required", { sheet: c.sheet, row: c.row, field }); return null; }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"))) return s;
  c.issues.error("field.date", { sheet: c.sheet, row: c.row, field, value: showValue(v) });
  return null;
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeLabel(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Checks required/known headers; returns false when a required header is missing. */
export function checkHeaders(sheet: Sheet | undefined, name: string, required: string[], optional: string[], issues: IssueList): boolean {
  if (!sheet) { issues.error("sheet.missing", { sheet: name }); return false; }
  let ok = true;
  for (const h of required) {
    if (!sheet.headers.includes(h)) { issues.error("header.missing", { sheet: name, row: 1, field: h }); ok = false; }
  }
  for (const h of sheet.headers) {
    if (!required.includes(h) && !optional.includes(h)) issues.warn("header.unknown", { sheet: name, row: 1, field: h });
  }
  return ok;
}
