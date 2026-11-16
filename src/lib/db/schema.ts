import {
  pgTable, serial, text, integer, boolean, timestamp, jsonb, doublePrecision, date,
  uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  brandLabel: text("brand_label").notNull().default("DeDecker"),
  clientDomains: text("client_domains").array().notNull().default([]),
  activeSeoVersionId: integer("active_seo_version_id"),
  geoRevision: integer("geo_revision").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const markets = pgTable("markets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  code: text("code").notNull(),
  country: text("country").notNull(),
  language: text("language").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => [uniqueIndex("markets_project_code").on(t.projectId, t.code)]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull().default("viewer"),
  active: boolean("active").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const importEvents = pgTable("import_events", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  kind: text("kind", { enum: ["seo", "geo"] }).notNull(),
  action: text("action").notNull(),
  refId: integer("ref_id"),
  actorId: integer("actor_id"),
  reason: text("reason"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("import_events_project").on(t.projectId, t.kind, t.createdAt)]);

/* ---------------- SEO snapshots ---------------- */

export const seoVersions = pgTable("seo_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  version: integer("version").notNull(),
  status: text("status", { enum: ["validated", "failed", "published", "archived"] }).notNull(),
  sha256: text("sha256").notNull(),
  filename: text("filename").notNull(),
  storageUrl: text("storage_url"),
  fileSize: integer("file_size").notNull().default(0),
  markets: text("markets").array().notNull().default([]),
  summary: jsonb("summary"),
  issues: jsonb("issues"),
  authorId: integer("author_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: integer("published_by"),
}, (t) => [
  uniqueIndex("seo_versions_project_sha").on(t.projectId, t.sha256),
  uniqueIndex("seo_versions_project_version").on(t.projectId, t.version),
]);

export const seoMarketMeta = pgTable("seo_market_meta", {
  versionId: integer("version_id").notNull().references(() => seoVersions.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  source: text("source").notNull(),
  notes: text("notes"),
  device: text("device"),
  serpDepth: integer("serp_depth"),
  currency: text("currency"),
}, (t) => [primaryKey({ columns: [t.versionId, t.market] })]);

export const seoCategories = pgTable("seo_categories", {
  versionId: integer("version_id").notNull().references(() => seoVersions.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
  categoryId: text("category_id").notNull(),
  label: text("label").notNull(),
  include: boolean("include_in_dashboard").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (t) => [primaryKey({ columns: [t.versionId, t.market, t.categoryId] })]);

export const seoKeywords = pgTable("seo_keywords", {
  versionId: integer("version_id").notNull().references(() => seoVersions.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
  keywordId: text("keyword_id").notNull(),
  keyword: text("keyword").notNull(),
  categoryId: text("category_id").notNull(),
  volume: integer("volume").notNull(),
  hasAiOverview: boolean("has_ai_overview").notNull(),
  clientInAi: boolean("client_in_ai").notNull(),
  clientPos: integer("client_pos"),
  clientUrl: text("client_url"),
  clientAiSources: text("client_ai_sources").array().notNull().default([]),
  subcategory: text("subcategory"),
  priority: text("priority"),
  source: text("source"),
  cpc: doublePrecision("cpc"),
  competition: text("competition"),
  paa: text("paa"),
  legacyIlwaPos: integer("legacy_ilwa_pos"),
  sortOrder: integer("sort_order").notNull(),
}, (t) => [
  primaryKey({ columns: [t.versionId, t.market, t.keywordId] }),
  index("seo_keywords_lookup").on(t.versionId, t.market, t.categoryId),
]);

export const seoCompetitors = pgTable("seo_competitors", {
  versionId: integer("version_id").notNull().references(() => seoVersions.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
  domain: text("domain").notNull(),
  label: text("label").notNull(),
  colorHex: text("color_hex"),
  sortOrder: integer("sort_order").notNull(),
}, (t) => [primaryKey({ columns: [t.versionId, t.market, t.domain] })]);

export const seoCompetitorScopes = pgTable("seo_competitor_scopes", {
  versionId: integer("version_id").notNull().references(() => seoVersions.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
  scope: text("scope").notNull(),
  domain: text("domain").notNull(),
  sortOrder: integer("sort_order").notNull(),
}, (t) => [primaryKey({ columns: [t.versionId, t.market, t.scope, t.domain] })]);

export const seoRankings = pgTable("seo_rankings", {
  versionId: integer("version_id").notNull().references(() => seoVersions.id, { onDelete: "cascade" }),
  market: text("market").notNull(),
  keywordId: text("keyword_id").notNull(),
  domain: text("domain").notNull(),
  position: integer("position").notNull(),
}, (t) => [primaryKey({ columns: [t.versionId, t.market, t.keywordId, t.domain] })]);

/* ---------------- GEO tracking ---------------- */

export const geoBatches = pgTable("geo_batches", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  status: text("status", { enum: ["validated", "failed", "published"] }).notNull(),
  sha256: text("sha256").notNull(),
  filename: text("filename").notNull(),
  storageUrl: text("storage_url"),
  fileSize: integer("file_size").notNull().default(0),
  baseRevision: integer("base_revision").notNull().default(0),
  payload: jsonb("payload"),
  summary: jsonb("summary"),
  issues: jsonb("issues"),
  authorId: integer("author_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  publishedBy: integer("published_by"),
}, (t) => [uniqueIndex("geo_batches_project_sha").on(t.projectId, t.sha256)]);

export const geoQuestions = pgTable("geo_questions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  market: text("market").notNull(),
  questionId: text("question_id").notNull(),
  questionVersion: integer("question_version").notNull(),
  question: text("question").notNull(),
  categoryId: text("category_id"),
  seoKeywordId: text("seo_keyword_id"),
  persona: text("persona"),
  topicGroupId: text("topic_group_id"),
  batchId: integer("batch_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("geo_questions_key").on(t.projectId, t.market, t.questionId, t.questionVersion)]);

export const geoQuestionStates = pgTable("geo_question_states", {
  projectId: integer("project_id").notNull().references(() => projects.id),
  market: text("market").notNull(),
  questionId: text("question_id").notNull(),
  status: text("status", { enum: ["active", "archived"] }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by"),
}, (t) => [primaryKey({ columns: [t.projectId, t.market, t.questionId] })]);

export const geoRuns = pgTable("geo_runs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  runId: text("run_id").notNull(),
  market: text("market").notNull(),
  questionId: text("question_id").notNull(),
  questionVersion: integer("question_version").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  platform: text("platform").notNull(),
  model: text("model").notNull(),
  webSearch: text("web_search", { enum: ["on", "off", "unknown"] }).notNull(),
  status: text("status", { enum: ["success", "error"] }).notNull(),
  brandMentioned: boolean("brand_mentioned"),
  answerText: text("answer_text"),
  errorCode: text("error_code"),
  contentHash: text("content_hash").notNull(),
  batchId: integer("batch_id"),
  replacesRunId: text("replaces_run_id"),
  invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
  invalidatedBy: integer("invalidated_by"),
  invalidReason: text("invalid_reason"),
}, (t) => [
  uniqueIndex("geo_runs_key").on(t.projectId, t.runId),
  index("geo_runs_lookup").on(t.projectId, t.market, t.observedAt),
]);

export const geoCitations = pgTable("geo_citations", {
  id: serial("id").primaryKey(),
  runPk: integer("run_pk").notNull().references(() => geoRuns.id, { onDelete: "cascade" }),
  citedUrl: text("cited_url").notNull(),
  host: text("host").notNull(),
  citationOrder: integer("citation_order"),
}, (t) => [index("geo_citations_run").on(t.runPk)]);
