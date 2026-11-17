import ExcelJS from "exceljs";
import { EXCLUDED_CATEGORIES } from "../config";
import type { MarketData, SeoCategory, SeoCompetitor, SeoKeyword, SeoRanking, SeoScope } from "./types";

export type RawRow = Record<string, unknown>;
export type SourceFile = { name: string; rows: RawRow[]; modified: Date | null; serp?: RawRow[] };
export type SerpRow = { keyword: string; position: number; domain: string; url: string };

const UNCATEGORISED = "Non catégorisé";
const TRUE_VALUES = new Set(["true", "1", "yes", "vrai", "ja", "waar", "oui", "x"]);

/** Accent-, case- and punctuation-insensitive key ("Salle de bains" ~ "salle_de_bains"). */
export const normKey = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as { result?: unknown; hyperlink?: string; text?: unknown; richText?: { text: string }[]; error?: string };
    if (o.error) return "";
    if ("result" in o) return text(o.result);
    if (o.richText) return o.richText.map((t) => t.text).join("").trim();
    if (o.text !== undefined) return text(o.text);
    if (o.hyperlink) return o.hyperlink.trim();
  }
  return String(v).trim();
}
const num = (v: unknown): number | null => {
  const s = text(v).replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
/** Positions: empty, 0 or non-numeric = not ranked. */
const pos = (v: unknown): number | null => {
  const n = num(v);
  return n === null || n <= 0 ? null : Math.round(n);
};
const bool = (v: unknown) => TRUE_VALUES.has(text(v).toLowerCase());
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);

function sheetRows(ws: ExcelJS.Worksheet | undefined): RawRow[] {
  const rows: RawRow[] = [];
  if (!ws) return rows;
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { headers[col] = text(c.value); });
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const o: RawRow = {};
    headers.forEach((h, col) => { if (h && !(h in o)) o[h] = r.getCell(col).value; });
    rows.push(o);
  });
  return rows;
}

/** Reads the first worksheet of a workbook, plus its `serp` worksheet (full Google results per keyword) when present. */
export async function readFirstSheet(buf: Uint8Array, name: string): Promise<SourceFile> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const serp = wb.worksheets.slice(1).find((ws) => ws.name.trim().toLowerCase() === "serp");
  return { name, rows: sheetRows(wb.worksheets[0]), modified: wb.modified ?? null, ...(serp ? { serp: sheetRows(serp) } : {}) };
}

/** Rows of the `serp` worksheets (keyword, position, domain, url). */
export function serpRows(files: SourceFile[]): SerpRow[] {
  const out: SerpRow[] = [];
  for (const f of files) {
    const c = columns(f.serp ?? []);
    for (const r of f.serp ?? []) {
      const keyword = text(c.get(r, "keyword")).toLowerCase(), position = pos(c.get(r, "position"));
      const domain = text(c.get(r, "domain")).toLowerCase().replace(/^www\./, "");
      if (keyword && position && domain) out.push({ keyword, position, domain, url: text(c.get(r, "url")) });
    }
  }
  return out;
}

/** Case-insensitive column lookup ("Category" and "category" are the same column). */
function columns(rows: RawRow[]) {
  const map = new Map<string, string>();
  for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) if (!map.has(k.toLowerCase())) map.set(k.toLowerCase(), k);
  return {
    get: (r: RawRow, name: string) => { const k = map.get(name); return k === undefined ? undefined : r[k]; },
    /** `category`, or `label` when the workbook has no category column. */
    category: (r: RawRow) => r[map.get("category") ?? map.get("label") ?? ""],
    competitorCols: [...map.entries()].filter(([lc]) => lc.endsWith("_pos") && lc !== "client_pos").map(([lc, k]) => ({ domain: lc.slice(0, -4).trim(), col: k })),
  };
}

/**
 * Builds a market from the Streamlit-format workbooks of one folder.
 * The first workbook whose name does not contain a category name is the main file (keywords, volumes, client positions,
 * AI Overviews). A workbook whose name contains a category (e.g. "..._badkamers_...") only adds the competitors
 * of that category, matched on `keyword`.
 */
export function buildMarket(market: string, input: SourceFile[]): MarketData | null {
  const files = [...input].sort((a, b) => a.name.localeCompare(b.name)).filter((f) => f.rows.length > 0);
  if (files.length === 0) return null;

  const catVariants = new Map<string, Map<string, number>>();
  const catOf = (raw: string) => {
    const label = raw || UNCATEGORISED;
    const key = normKey(label) || normKey(UNCATEGORISED);
    const v = catVariants.get(key) ?? new Map<string, number>();
    v.set(label, (v.get(label) ?? 0) + 1);
    catVariants.set(key, v);
    return key;
  };
  for (const f of files) { const c = columns(f.rows); f.rows.forEach((r) => catOf(text(c.category(r)))); }
  catVariants.forEach((v) => v.clear());

  const catKeys = [...catVariants.keys()].filter((k) => k.length >= 4).sort((a, b) => b.length - a.length || a.localeCompare(b));
  const scopeOfFile = (f: SourceFile) => catKeys.find((k) => normKey(f.name.replace(/\.xlsx$/i, "")).includes(k)) ?? null;
  const main = files.find((f) => scopeOfFile(f) === null) ?? files[0];
  const mainCols = columns(main.rows);

  const keywords: SeoKeyword[] = [];
  const seen = new Set<string>();
  for (const r of main.rows) {
    const kw = text(mainCols.get(r, "keyword"));
    if (!kw || seen.has(kw.toLowerCase())) continue;
    seen.add(kw.toLowerCase());
    const hasAi = bool(mainCols.get(r, "has_ai_overview"));
    const url = text(mainCols.get(r, "client_url"));
    keywords.push({
      market, keywordId: `${market}-${keywords.length + 1}`, keyword: kw,
      categoryId: catOf(text(mainCols.category(r))),
      volume: Math.max(0, Math.round(num(mainCols.get(r, "volume")) ?? 0)),
      hasAiOverview: hasAi, clientInAi: hasAi && bool(mainCols.get(r, "client_in_ai")),
      clientPos: pos(mainCols.get(r, "client_pos")), clientUrl: isUrl(url) ? url : null,
      clientAiSources: text(mainCols.get(r, "client_ai_sources")).split(/[\s,;|]+/).filter(isUrl),
      subcategory: text(mainCols.get(r, "subcategory")) || null, priority: text(mainCols.get(r, "priority")) || null,
      source: text(mainCols.get(r, "source")) || null, cpc: num(mainCols.get(r, "cpc")),
      competition: text(mainCols.get(r, "competition")) || null, paa: text(mainCols.get(r, "paa")) || null,
      sortOrder: keywords.length + 1,
    });
  }
  if (keywords.length === 0) return null;

  const excluded = new Set(EXCLUDED_CATEGORIES.map(normKey));
  const categories: SeoCategory[] = [...catVariants.entries()]
    .filter(([, v]) => v.size > 0)
    .map(([key, v]) => ({ key, label: [...v.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0] }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((c, i) => ({ market, categoryId: c.key, label: c.label, include: !excluded.has(c.key), sortOrder: i + 1 }));
  const ids = new Map(categories.map((c) => [c.categoryId, slug(c.label)]));
  for (const k of keywords) k.categoryId = ids.get(k.categoryId)!;
  for (const c of categories) c.categoryId = ids.get(c.categoryId)!;

  const competitors: SeoCompetitor[] = [];
  const scopes: SeoScope[] = [];
  const rankings: SeoRanking[] = [];
  const ranked = new Set<string>();
  for (const f of [main, ...files.filter((x) => x !== main)]) {
    const c = columns(f.rows);
    const scopeKey = f === main ? null : scopeOfFile(f);
    const scope = scopeKey ? ids.get(scopeKey) ?? "default" : "default";
    const byKw = new Map<string, RawRow>();
    for (const r of f.rows) { const kw = text(c.get(r, "keyword")).toLowerCase(); if (kw && !byKw.has(kw)) byKw.set(kw, r); }
    for (const { domain, col } of c.competitorCols) {
      if (!competitors.some((x) => x.domain === domain)) {
        competitors.push({ market, domain, label: domain, colorHex: null, sortOrder: competitors.length + 1 });
      }
      if (!scopes.some((s) => s.scope === scope && s.domain === domain))
        scopes.push({ market, scope, domain, sortOrder: scopes.filter((s) => s.scope === scope).length + 1 });
      for (const k of keywords) {
        const row = byKw.get(k.keyword.toLowerCase());
        const p = row ? pos(row[col]) : null;
        const key = `${k.keywordId}|${domain}`;
        if (p !== null && !ranked.has(key)) { ranked.add(key); rankings.push({ market, keywordId: k.keywordId, domain, position: p }); }
      }
    }
  }

  const dates = files.map((f) => f.modified).filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()));
  const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  return {
    meta: { market, snapshotDate: latest ? latest.toISOString().slice(0, 10) : "", source: files.map((f) => f.name).join(" + "), notes: null, device: null, serpDepth: null, currency: null },
    categories, keywords, competitors, scopes, rankings,
  };
}
