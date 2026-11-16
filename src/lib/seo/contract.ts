import { IssueList, showValue } from "../issues";
import {
  type Workbook, type FieldCtx, checkHeaders, reqText, optText, parseInteger, parseDecimal, parseBool, parseIsoDate,
  isHttpUrl, normalizeLabel,
} from "../xlsx/read";
import { IMPORT_LIMITS } from "../config";
import type { SeoSnapshot, SeoMarketMeta, SeoCategory, SeoKeyword, SeoCompetitor, SeoScope, SeoRanking } from "./types";

export const SEO_SCHEMA_VERSION = "1";

export const SEO_SHEETS = {
  Meta: { required: ["schema_version", "market", "snapshot_date", "source"], optional: ["notes", "device", "serp_depth", "currency"] },
  Categories: { required: ["market", "category_id", "label", "include_in_dashboard", "sort_order"], optional: [] },
  Keywords: {
    required: ["market", "keyword_id", "keyword", "volume", "category_id", "has_ai_overview", "client_in_ai"],
    optional: ["client_pos", "client_url", "client_ai_sources", "subcategory", "priority", "source", "cpc", "competition", "paa", "legacy_ilwa_pos"],
  },
  Competitors: { required: ["market", "domain", "label", "sort_order"], optional: ["color_hex"] },
  CompetitorScopes: { required: ["market", "scope", "domain", "sort_order"], optional: [] },
  Rankings: { required: ["market", "keyword_id", "domain", "position"], optional: [] },
} as const;

export function normalizeDomain(s: string): string {
  return s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

export type SeoParseResult = { snapshot: SeoSnapshot | null; issues: IssueList };

export function parseSeoWorkbook(wb: Workbook, knownMarkets: string[], issues = new IssueList()): SeoParseResult {
  let headersOk = true;
  for (const [name, spec] of Object.entries(SEO_SHEETS)) {
    if (!checkHeaders(wb.get(name), name, [...spec.required], [...spec.optional], issues)) headersOk = false;
  }
  if (!headersOk) return { snapshot: null, issues };

  const ctx = (sheet: string, row: number): FieldCtx => ({ issues, sheet, row });
  const marketOf = (v: unknown, c: FieldCtx): string | null => {
    const m = reqText(v as never, "market", c);
    if (m === null) return null;
    const code = m.toUpperCase();
    if (!knownMarkets.includes(code)) { issues.error("ref.market", { sheet: c.sheet, row: c.row, field: "market", value: m }); return null; }
    return code;
  };

  /* Meta */
  const meta: SeoMarketMeta[] = [];
  for (const r of wb.get("Meta")!.rows) {
    const c = ctx("Meta", r.row);
    const sv = reqText(r.values.schema_version, "schema_version", c);
    if (sv !== null && sv.replace(/\.0$/, "") !== SEO_SCHEMA_VERSION) issues.error("meta.schema_version", { ...c, field: "schema_version", value: sv, params: { expected: SEO_SCHEMA_VERSION } });
    const market = marketOf(r.values.market, c);
    const snapshotDate = parseIsoDate(r.values.snapshot_date, "snapshot_date", c);
    const source = reqText(r.values.source, "source", c);
    if (!market || !snapshotDate || !source) continue;
    if (meta.some((m) => m.market === market)) { issues.error("dup.meta_market", { ...c, field: "market", value: market }); continue; }
    meta.push({
      market, snapshotDate, source, notes: optText(r.values.notes ?? null), device: optText(r.values.device ?? null),
      serpDepth: parseInteger(r.values.serp_depth ?? null, "serp_depth", c, { min: 1, required: false }),
      currency: optText(r.values.currency ?? null),
    });
  }
  if (meta.length === 0) issues.error("meta.empty", { sheet: "Meta" });
  const metaMarkets = new Set(meta.map((m) => m.market));
  const inMeta = (market: string, c: FieldCtx) => {
    if (!metaMarkets.has(market)) { issues.error("ref.meta_market", { ...c, field: "market", value: market }); return false; }
    return true;
  };

  /* Categories */
  const categories: SeoCategory[] = [];
  const catKeys = new Set<string>();
  const catSort = new Set<string>();
  for (const r of wb.get("Categories")!.rows) {
    const c = ctx("Categories", r.row);
    const market = marketOf(r.values.market, c);
    const categoryId = reqText(r.values.category_id, "category_id", c);
    const label = reqText(r.values.label, "label", c);
    const include = parseBool(r.values.include_in_dashboard, "include_in_dashboard", c);
    const sortOrder = parseInteger(r.values.sort_order, "sort_order", c, { min: 0, required: true });
    if (!market || !categoryId || !label || include === null || sortOrder === null || !inMeta(market, c)) continue;
    const key = `${market}|${categoryId}`;
    if (catKeys.has(key)) { issues.error("dup.category", { ...c, field: "category_id", value: categoryId }); continue; }
    if (catSort.has(`${market}|${sortOrder}`)) issues.warn("dup.sort_order", { ...c, field: "sort_order", value: String(sortOrder) });
    catKeys.add(key); catSort.add(`${market}|${sortOrder}`);
    categories.push({ market, categoryId, label, include, sortOrder });
  }

  /* Keywords */
  const keywords: SeoKeyword[] = [];
  const kwIds = new Set<string>();
  const kwNorm = new Map<string, number>();
  const kwRows = wb.get("Keywords")!.rows;
  if (kwRows.length > IMPORT_LIMITS.maxKeywords) {
    issues.error("limit.keywords", { sheet: "Keywords", params: { max: IMPORT_LIMITS.maxKeywords, count: kwRows.length } });
    return { snapshot: null, issues };
  }
  kwRows.forEach((r, idx) => {
    const c = ctx("Keywords", r.row);
    const v = r.values;
    const market = marketOf(v.market, c);
    const keywordId = reqText(v.keyword_id, "keyword_id", c);
    const keyword = reqText(v.keyword, "keyword", c);
    const volume = parseInteger(v.volume, "volume", c, { min: 0, required: true });
    const categoryId = reqText(v.category_id, "category_id", c);
    const hasAiOverview = parseBool(v.has_ai_overview, "has_ai_overview", c);
    const clientInAi = parseBool(v.client_in_ai, "client_in_ai", c);
    const clientPos = parseInteger(v.client_pos ?? null, "client_pos", c, { min: 1, required: false });
    const clientUrl = optText(v.client_url ?? null);
    if (clientUrl && !isHttpUrl(clientUrl)) issues.error("field.url", { ...c, field: "client_url", value: showValue(clientUrl) });
    const sourcesRaw = optText(v.client_ai_sources ?? null);
    const clientAiSources = sourcesRaw ? sourcesRaw.split(/[\s,;|]+/).filter(Boolean) : [];
    for (const u of clientAiSources) if (!isHttpUrl(u)) issues.error("field.url", { ...c, field: "client_ai_sources", value: showValue(u) });
    if (!market || !keywordId || !keyword || volume === null || !categoryId || hasAiOverview === null || clientInAi === null) return;
    if (!inMeta(market, c)) return;
    let ok = true;
    if (!catKeys.has(`${market}|${categoryId}`)) { issues.error("ref.category", { ...c, field: "category_id", value: categoryId }); ok = false; }
    if (clientInAi && !hasAiOverview) { issues.error("ai.cited_without_overview", { ...c, field: "client_in_ai" }); ok = false; }
    const idKey = `${market}|${keywordId}`;
    if (kwIds.has(idKey)) { issues.error("dup.keyword_id", { ...c, field: "keyword_id", value: keywordId }); ok = false; }
    const normKey = `${market}|${normalizeLabel(keyword)}`;
    if (kwNorm.has(normKey)) { issues.error("dup.keyword", { ...c, field: "keyword", value: keyword, params: { other: kwNorm.get(normKey)! } }); ok = false; }
    if (!kwIds.has(idKey)) kwIds.add(idKey);
    if (!kwNorm.has(normKey)) kwNorm.set(normKey, r.row);
    if (!ok) return;
    keywords.push({
      market, keywordId, keyword: keyword.normalize("NFC").trim().replace(/\s+/g, " "), categoryId, volume, hasAiOverview, clientInAi,
      clientPos, clientUrl, clientAiSources, subcategory: optText(v.subcategory ?? null), priority: optText(v.priority ?? null),
      source: optText(v.source ?? null), cpc: parseDecimal(v.cpc ?? null, "cpc", c), competition: optText(v.competition ?? null),
      paa: optText(v.paa ?? null), legacyIlwaPos: parseInteger(v.legacy_ilwa_pos ?? null, "legacy_ilwa_pos", c, { min: 1, required: false }),
      sortOrder: idx,
    });
  });

  /* Competitors */
  const competitors: SeoCompetitor[] = [];
  const compKeys = new Set<string>();
  for (const r of wb.get("Competitors")!.rows) {
    const c = ctx("Competitors", r.row);
    const market = marketOf(r.values.market, c);
    const domainRaw = reqText(r.values.domain, "domain", c);
    const label = reqText(r.values.label, "label", c);
    const sortOrder = parseInteger(r.values.sort_order, "sort_order", c, { min: 0, required: true });
    const color = optText(r.values.color_hex ?? null);
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) issues.error("field.color", { ...c, field: "color_hex", value: color });
    if (!market || !domainRaw || !label || sortOrder === null || !inMeta(market, c)) continue;
    const domain = normalizeDomain(domainRaw);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) { issues.error("field.domain", { ...c, field: "domain", value: domainRaw }); continue; }
    if (compKeys.has(`${market}|${domain}`)) { issues.error("dup.competitor", { ...c, field: "domain", value: domain }); continue; }
    compKeys.add(`${market}|${domain}`);
    competitors.push({ market, domain, label, colorHex: color && /^#[0-9a-f]{6}$/i.test(color) ? color : null, sortOrder });
  }

  /* CompetitorScopes */
  const scopes: SeoScope[] = [];
  const scopeKeys = new Set<string>();
  const scopeSort = new Set<string>();
  for (const r of wb.get("CompetitorScopes")!.rows) {
    const c = ctx("CompetitorScopes", r.row);
    const market = marketOf(r.values.market, c);
    const scope = reqText(r.values.scope, "scope", c);
    const domainRaw = reqText(r.values.domain, "domain", c);
    const sortOrder = parseInteger(r.values.sort_order, "sort_order", c, { min: 0, required: true });
    if (!market || !scope || !domainRaw || sortOrder === null || !inMeta(market, c)) continue;
    const domain = normalizeDomain(domainRaw);
    if (scope !== "default" && !catKeys.has(`${market}|${scope}`)) { issues.error("ref.scope", { ...c, field: "scope", value: scope }); continue; }
    if (!compKeys.has(`${market}|${domain}`)) { issues.error("ref.competitor", { ...c, field: "domain", value: domain }); continue; }
    const key = `${market}|${scope}|${domain}`;
    if (scopeKeys.has(key)) { issues.error("dup.scope_domain", { ...c, field: "domain", value: domain }); continue; }
    const sk = `${market}|${scope}|${sortOrder}`;
    if (scopeSort.has(sk)) { issues.error("dup.scope_sort", { ...c, field: "sort_order", value: String(sortOrder) }); continue; }
    scopeKeys.add(key); scopeSort.add(sk);
    scopes.push({ market, scope, domain, sortOrder });
  }
  for (const m of metaMarkets) {
    if (!scopes.some((s) => s.market === m && s.scope === "default")) issues.error("scope.default_missing", { sheet: "CompetitorScopes", value: m });
  }

  /* Rankings */
  const rankings: SeoRanking[] = [];
  const rankRows = wb.get("Rankings")!.rows;
  if (rankRows.length > IMPORT_LIMITS.maxRankings) {
    issues.error("limit.rankings", { sheet: "Rankings", params: { max: IMPORT_LIMITS.maxRankings, count: rankRows.length } });
    return { snapshot: null, issues };
  }
  const rankKeys = new Set<string>();
  for (const r of rankRows) {
    const c = ctx("Rankings", r.row);
    const market = marketOf(r.values.market, c);
    const keywordId = reqText(r.values.keyword_id, "keyword_id", c);
    const domainRaw = reqText(r.values.domain, "domain", c);
    const position = parseInteger(r.values.position, "position", c, { min: 1, required: true });
    if (!market || !keywordId || !domainRaw || position === null || !inMeta(market, c)) continue;
    const domain = normalizeDomain(domainRaw);
    if (!kwIds.has(`${market}|${keywordId}`)) { issues.error("ref.keyword", { ...c, field: "keyword_id", value: keywordId }); continue; }
    if (!compKeys.has(`${market}|${domain}`)) { issues.error("ref.competitor", { ...c, field: "domain", value: domain }); continue; }
    const key = `${market}|${keywordId}|${domain}`;
    if (rankKeys.has(key)) { issues.error("dup.ranking", { ...c, field: "domain", value: domain }); continue; }
    rankKeys.add(key);
    rankings.push({ market, keywordId, domain, position });
  }

  for (const m of metaMarkets) {
    if (!keywords.some((k) => k.market === m)) issues.warn("market.no_keywords", { sheet: "Keywords", value: m });
  }

  if (issues.hasErrors()) return { snapshot: null, issues };
  return { snapshot: { meta, categories, keywords, competitors, scopes, rankings }, issues };
}

export function summarizeSnapshot(s: SeoSnapshot) {
  return s.meta.map((m) => {
    const included = new Set(s.categories.filter((c) => c.market === m.market && c.include).map((c) => c.categoryId));
    const kws = s.keywords.filter((k) => k.market === m.market);
    const inc = kws.filter((k) => included.has(k.categoryId));
    return {
      market: m.market, snapshotDate: m.snapshotDate, source: m.source,
      categories: s.categories.filter((c) => c.market === m.market).length,
      keywords: kws.length, includedKeywords: inc.length, excludedKeywords: kws.length - inc.length,
      volume: inc.reduce((a, k) => a + k.volume, 0),
      competitors: s.competitors.filter((c) => c.market === m.market).length,
      rankings: s.rankings.filter((r) => r.market === m.market).length,
    };
  });
}
