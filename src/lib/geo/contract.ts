import { createHash } from "node:crypto";
import { IssueList, showValue } from "../issues";
import { type Workbook, type FieldCtx, type Cell, checkHeaders, reqText, optText, parseInteger, parseBool, parseIsoDate, isHttpUrl } from "../xlsx/read";
import { IMPORT_LIMITS } from "../config";
import type { GeoBatch, GeoQuestionRow, GeoRunRow, WebSearch } from "./types";

export const GEO_SCHEMA_VERSION = "1";
export const GEO_SHEETS = {
  Meta: { required: ["schema_version", "market", "source", "collected_from", "collected_to"], optional: ["notes"] },
  Questions: { required: ["question_id", "question_version", "question", "status"], optional: ["category_id", "seo_keyword_id", "persona", "topic_group_id"] },
  Runs: {
    required: ["run_id", "question_id", "question_version", "observed_at", "platform", "model", "web_search", "status", "brand_mentioned"],
    optional: ["answer_text", "error_code", "replaces_run_id"],
  },
  Citations: { required: ["run_id", "cited_url", "citation_order"], optional: [] },
} as const;

export function urlHost(u: string): string {
  return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
}

/** Normalizes a cited URL for duplicate detection (host case, www, fragment, trailing slash). */
export function normalizeUrl(u: string): string {
  const url = new URL(u);
  url.hash = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `${host}${url.port ? ":" + url.port : ""}${path}${url.search}`;
}

export function hostMatches(host: string, domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith("." + d));
}

function parseTimestamp(v: Cell, c: FieldCtx): string | null {
  if (v === null) { c.issues.error("field.required", { sheet: c.sheet, row: c.row, field: "observed_at" }); return null; }
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    c.issues.warn("geo.timestamp_no_tz", { sheet: c.sheet, row: c.row, field: "observed_at", value: s });
    const d = new Date(s.replace(" ", "T") + "Z");
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  c.issues.error("field.datetime", { sheet: c.sheet, row: c.row, field: "observed_at", value: showValue(v) });
  return null;
}

function parseWebSearch(v: Cell, c: FieldCtx): WebSearch | null {
  if (v === null) return "unknown";
  const s = String(v).trim().toLowerCase();
  if (["on", "true", "1", "yes", "vrai", "oui"].includes(s) || v === true) return "on";
  if (["off", "false", "0", "no", "faux", "non"].includes(s) || v === false) return "off";
  if (["unknown", "?", "n/a"].includes(s)) return "unknown";
  c.issues.error("field.web_search", { sheet: c.sheet, row: c.row, field: "web_search", value: showValue(v) });
  return null;
}

export function runContentHash(r: Omit<GeoRunRow, "contentHash">): string {
  const canonical = JSON.stringify([
    r.runId, r.questionId, r.questionVersion, r.observedAt, r.platform, r.model, r.webSearch, r.status, r.brandMentioned,
    r.answerText ?? "", r.errorCode ?? "", r.replacesRunId ?? "",
    [...r.citations].sort((a, b) => (a.citationOrder ?? 0) - (b.citationOrder ?? 0) || a.citedUrl.localeCompare(b.citedUrl)).map((x) => [x.citedUrl, x.citationOrder]),
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export function parseGeoWorkbook(wb: Workbook, knownMarkets: string[], issues = new IssueList()): { batch: GeoBatch | null; issues: IssueList } {
  let ok = true;
  for (const [name, spec] of Object.entries(GEO_SHEETS)) {
    if (!checkHeaders(wb.get(name), name, [...spec.required], [...spec.optional], issues)) ok = false;
  }
  if (!ok) return { batch: null, issues };
  const ctx = (sheet: string, row: number): FieldCtx => ({ issues, sheet, row });

  const metaRows = wb.get("Meta")!.rows;
  if (metaRows.length !== 1) { issues.error("geo.meta_single", { sheet: "Meta", params: { count: metaRows.length } }); return { batch: null, issues }; }
  const m = metaRows[0];
  const mc = ctx("Meta", m.row);
  const sv = reqText(m.values.schema_version, "schema_version", mc);
  if (sv !== null && sv.replace(/\.0$/, "") !== GEO_SCHEMA_VERSION) issues.error("meta.schema_version", { ...mc, field: "schema_version", value: sv, params: { expected: GEO_SCHEMA_VERSION } });
  const marketRaw = reqText(m.values.market, "market", mc);
  const market = marketRaw?.toUpperCase() ?? null;
  if (market && !knownMarkets.includes(market)) issues.error("ref.market", { ...mc, field: "market", value: marketRaw! });
  const source = reqText(m.values.source, "source", mc);
  const collectedFrom = parseIsoDate(m.values.collected_from, "collected_from", mc);
  const collectedTo = parseIsoDate(m.values.collected_to, "collected_to", mc);
  if (collectedFrom && collectedTo && collectedFrom > collectedTo) issues.error("geo.period_order", { ...mc, field: "collected_to" });

  const questions: GeoQuestionRow[] = [];
  const qKeys = new Map<string, string>();
  const qLatest = new Map<string, number>();
  for (const r of wb.get("Questions")!.rows) {
    const c = ctx("Questions", r.row);
    const questionId = reqText(r.values.question_id, "question_id", c);
    const questionVersion = parseInteger(r.values.question_version, "question_version", c, { min: 1, required: true });
    const question = reqText(r.values.question, "question", c);
    const statusRaw = reqText(r.values.status, "status", c)?.toLowerCase();
    const status = statusRaw === "active" || statusRaw === "archived" ? statusRaw : null;
    if (statusRaw && !status) issues.error("field.enum", { ...c, field: "status", value: statusRaw, params: { allowed: "active, archived" } });
    if (!questionId || questionVersion === null || !question || !status) continue;
    const key = `${questionId}|${questionVersion}`;
    const label = question.normalize("NFC").trim().replace(/\s+/g, " ");
    if (qKeys.has(key)) { issues.error("dup.question_version", { ...c, field: "question_version", value: key }); continue; }
    for (const [k, l] of qKeys) if (k.startsWith(questionId + "|") && l === label) issues.warn("geo.same_label_new_version", { ...c, field: "question", value: key });
    qKeys.set(key, label);
    qLatest.set(questionId, Math.max(qLatest.get(questionId) ?? 0, questionVersion));
    questions.push({
      questionId, questionVersion, question: label, status, categoryId: optText(r.values.category_id ?? null),
      seoKeywordId: optText(r.values.seo_keyword_id ?? null), persona: optText(r.values.persona ?? null), topicGroupId: optText(r.values.topic_group_id ?? null),
    });
  }
  for (const [qid, latest] of qLatest) {
    const statuses = new Set(questions.filter((q) => q.questionId === qid).map((q) => q.status));
    if (statuses.size > 1) issues.warn("geo.status_latest_wins", { sheet: "Questions", value: `${qid} v${latest}` });
  }

  const citationsByRun = new Map<string, { citedUrl: string; host: string; citationOrder: number | null; row: number }[]>();
  for (const r of wb.get("Citations")!.rows) {
    const c = ctx("Citations", r.row);
    const runId = reqText(r.values.run_id, "run_id", c);
    const url = reqText(r.values.cited_url, "cited_url", c);
    const order = parseInteger(r.values.citation_order, "citation_order", c, { min: 1, required: false });
    if (!runId || !url) continue;
    if (!isHttpUrl(url)) { issues.error("field.url", { ...c, field: "cited_url", value: showValue(url) }); continue; }
    const list = citationsByRun.get(runId) ?? [];
    const norm = normalizeUrl(url);
    if (list.some((x) => normalizeUrl(x.citedUrl) === norm)) { issues.error("dup.citation_url", { ...c, field: "cited_url", value: showValue(url) }); continue; }
    list.push({ citedUrl: url, host: urlHost(url), citationOrder: order, row: r.row });
    citationsByRun.set(runId, list);
  }

  const runRows = wb.get("Runs")!.rows;
  if (runRows.length > IMPORT_LIMITS.maxGeoRuns) {
    issues.error("limit.runs", { sheet: "Runs", params: { max: IMPORT_LIMITS.maxGeoRuns, count: runRows.length } });
    return { batch: null, issues };
  }
  const runs: GeoRunRow[] = [];
  const runIds = new Set<string>();
  for (const r of runRows) {
    const c = ctx("Runs", r.row);
    const v = r.values;
    const runId = reqText(v.run_id, "run_id", c);
    const questionId = reqText(v.question_id, "question_id", c);
    const questionVersion = parseInteger(v.question_version, "question_version", c, { min: 1, required: true });
    const observedAt = parseTimestamp(v.observed_at, c);
    const platform = reqText(v.platform, "platform", c);
    const model = reqText(v.model, "model", c);
    const webSearch = parseWebSearch(v.web_search, c);
    const statusRaw = reqText(v.status, "status", c)?.toLowerCase();
    const status: GeoRunRow["status"] | null = statusRaw === "success" || statusRaw === "error" ? statusRaw : null;
    if (statusRaw && !status) issues.error("field.enum", { ...c, field: "status", value: statusRaw, params: { allowed: "success, error" } });
    if (!runId || !questionId || questionVersion === null || !observedAt || !platform || !model || !webSearch || !status) continue;
    if (runIds.has(runId)) { issues.error("dup.run_id", { ...c, field: "run_id", value: runId }); continue; }
    runIds.add(runId);
    const citations = (citationsByRun.get(runId) ?? []).map(({ row: _row, ...x }) => x);
    let brandMentioned: boolean | null = null;
    if (status === "error") {
      if (v.brand_mentioned !== null) issues.error("geo.error_with_brand", { ...c, field: "brand_mentioned" });
      if (citations.length > 0) issues.error("geo.error_with_citations", { ...c, field: "run_id", value: runId });
    } else {
      brandMentioned = parseBool(v.brand_mentioned, "brand_mentioned", c);
      if (brandMentioned === null) continue;
    }
    if (!qKeys.has(`${questionId}|${questionVersion}`)) issues.warn("geo.question_from_db", { ...c, field: "question_id", value: `${questionId} v${questionVersion}` });
    if (collectedFrom && collectedTo) {
      const day = observedAt.slice(0, 10);
      if (day < collectedFrom || day > collectedTo) issues.warn("geo.outside_period", { ...c, field: "observed_at", value: observedAt });
    }
    const base: Omit<GeoRunRow, "contentHash"> = {
      runId, questionId, questionVersion, observedAt, platform: platform.trim(), model: model.trim(), webSearch, status, brandMentioned,
      answerText: optText(v.answer_text ?? null), errorCode: optText(v.error_code ?? null), replacesRunId: optText(v.replaces_run_id ?? null), citations,
    };
    runs.push({ ...base, contentHash: runContentHash(base) });
  }
  for (const [runId, list] of citationsByRun) {
    if (!runIds.has(runId)) for (const x of list) issues.error("ref.run", { sheet: "Citations", row: x.row, field: "run_id", value: runId });
  }

  if (issues.hasErrors() || !market || !source || !collectedFrom || !collectedTo) return { batch: null, issues };
  return { batch: { market, source, collectedFrom, collectedTo, notes: optText(m.values.notes ?? null), questions, runs }, issues };
}
