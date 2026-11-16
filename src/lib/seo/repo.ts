import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema, type Tx } from "../db";
import type { Issue } from "../issues";
import type { MarketData, SeoSnapshot } from "./types";

const CHUNK = 2000;
async function insertChunks<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await fn(rows.slice(i, i + CHUNK));
}

export async function findSeoVersionBySha(projectId: number, sha: string) {
  const [v] = await db.select().from(schema.seoVersions).where(and(eq(schema.seoVersions.projectId, projectId), eq(schema.seoVersions.sha256, sha)));
  return v ?? null;
}

/** Records an import attempt; validated snapshots are stored with all their rows. */
export async function createSeoVersion(input: {
  projectId: number; sha: string; filename: string; storageUrl: string | null; fileSize: number; authorId: number;
  snapshot: SeoSnapshot | null; summary: unknown; issues: Issue[];
}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${input.projectId}, 1)`);
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${schema.seoVersions.version}), 0) + 1` }).from(schema.seoVersions).where(eq(schema.seoVersions.projectId, input.projectId));
    const [v] = await tx.insert(schema.seoVersions).values({
      projectId: input.projectId, version: Number(next), status: input.snapshot ? "validated" : "failed", sha256: input.sha,
      filename: input.filename, storageUrl: input.storageUrl, fileSize: input.fileSize, authorId: input.authorId,
      markets: input.snapshot?.meta.map((m) => m.market) ?? [], summary: input.summary, issues: input.issues.slice(0, 1000),
    }).returning();
    const s = input.snapshot;
    if (s) {
      const versionId = v.id;
      await insertChunks(s.meta, (c) => tx.insert(schema.seoMarketMeta).values(c.map((m) => ({ ...m, versionId }))));
      await insertChunks(s.categories, (c) => tx.insert(schema.seoCategories).values(c.map((m) => ({ ...m, versionId }))));
      await insertChunks(s.keywords, (c) => tx.insert(schema.seoKeywords).values(c.map((m) => ({ ...m, versionId }))));
      await insertChunks(s.competitors, (c) => tx.insert(schema.seoCompetitors).values(c.map((m) => ({ ...m, versionId }))));
      await insertChunks(s.scopes, (c) => tx.insert(schema.seoCompetitorScopes).values(c.map((m) => ({ ...m, versionId }))));
      await insertChunks(s.rankings, (c) => tx.insert(schema.seoRankings).values(c.map((m) => ({ ...m, versionId }))));
    }
    await tx.insert(schema.importEvents).values({ projectId: input.projectId, kind: "seo", action: s ? "validated" : "failed", refId: v.id, actorId: input.authorId, details: { filename: input.filename, sha256: input.sha } });
    return v;
  });
}

export class ConflictError extends Error {}

/** Publishes (or re-publishes for rollback) a validated version if the active pointer is unchanged. */
export async function publishSeoVersion(projectId: number, versionId: number, expectedActive: number | null, actorId: number, action: "published" | "rollback", reason: string | null) {
  return db.transaction(async (tx: Tx) => {
    const [p] = await tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)).for("update");
    if ((p.activeSeoVersionId ?? null) !== expectedActive) throw new ConflictError("active_changed");
    const [v] = await tx.select().from(schema.seoVersions).where(and(eq(schema.seoVersions.id, versionId), eq(schema.seoVersions.projectId, projectId)));
    if (!v || v.status === "failed") throw new ConflictError("not_publishable");
    if (p.activeSeoVersionId === v.id) throw new ConflictError("already_active");
    await tx.update(schema.projects).set({ activeSeoVersionId: v.id }).where(eq(schema.projects.id, projectId));
    await tx.update(schema.seoVersions).set({ status: "published", publishedAt: v.publishedAt ?? new Date(), publishedBy: v.publishedBy ?? actorId }).where(eq(schema.seoVersions.id, v.id));
    await tx.insert(schema.importEvents).values({ projectId, kind: "seo", action, refId: v.id, actorId, reason, details: { previous: expectedActive, version: v.version } });
    return v;
  });
}

export async function listSeoVersions(projectId: number) {
  return db.select({
    id: schema.seoVersions.id, version: schema.seoVersions.version, status: schema.seoVersions.status, filename: schema.seoVersions.filename,
    sha256: schema.seoVersions.sha256, markets: schema.seoVersions.markets, summary: schema.seoVersions.summary, createdAt: schema.seoVersions.createdAt,
    publishedAt: schema.seoVersions.publishedAt, authorEmail: schema.users.email,
  }).from(schema.seoVersions).leftJoin(schema.users, eq(schema.users.id, schema.seoVersions.authorId))
    .where(eq(schema.seoVersions.projectId, projectId)).orderBy(desc(schema.seoVersions.version)).limit(100);
}

export async function getSeoVersion(projectId: number, id: number) {
  const [v] = await db.select().from(schema.seoVersions).where(and(eq(schema.seoVersions.projectId, projectId), eq(schema.seoVersions.id, id)));
  return v ?? null;
}

export async function loadMarketData(versionId: number, market: string): Promise<MarketData | null> {
  const w = <T extends { versionId: unknown; market: unknown }>(t: T) => and(eq(t.versionId as never, versionId), eq(t.market as never, market));
  const [meta] = await db.select().from(schema.seoMarketMeta).where(w(schema.seoMarketMeta));
  if (!meta) return null;
  const [categories, keywords, competitors, scopes, rankings] = await Promise.all([
    db.select().from(schema.seoCategories).where(w(schema.seoCategories)).orderBy(asc(schema.seoCategories.sortOrder)),
    db.select().from(schema.seoKeywords).where(w(schema.seoKeywords)).orderBy(asc(schema.seoKeywords.sortOrder)),
    db.select().from(schema.seoCompetitors).where(w(schema.seoCompetitors)).orderBy(asc(schema.seoCompetitors.sortOrder)),
    db.select().from(schema.seoCompetitorScopes).where(w(schema.seoCompetitorScopes)),
    db.select().from(schema.seoRankings).where(w(schema.seoRankings)),
  ]);
  return { meta, categories, keywords, competitors, scopes, rankings } as MarketData;
}

/** Per-market summary of the currently published version, used to show variations in previews. */
export async function activeSummary(projectId: number) {
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (!p?.activeSeoVersionId) return { versionId: null, summary: null };
  const v = await getSeoVersion(projectId, p.activeSeoVersionId);
  return { versionId: p.activeSeoVersionId, summary: v?.summary ?? null };
}
