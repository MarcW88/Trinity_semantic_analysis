import "server-only";
import { IssueList, type Issue } from "./issues";
import { precheckXlsx, readWorkbook } from "./xlsx/read";
import { parseSeoWorkbook, summarizeSnapshot } from "./seo/contract";
import { parseGeoWorkbook } from "./geo/contract";
import { createSeoVersion, findSeoVersionBySha, activeSummary } from "./seo/repo";
import { createGeoBatch, findGeoBatchBySha, planGeoBatch } from "./geo/repo";
import { getMarkets } from "./project";
import { sha256, storeFile } from "./storage";
import type { CurrentUser } from "./auth/guard";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

export type ImportKind = "seo" | "geo";

export function safeFilename(name: string): string {
  return name.normalize("NFC").replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 150) || "upload.xlsx";
}

/** Validates an uploaded workbook and records the attempt (idempotent on the file's SHA-256). */
export async function processImport(user: CurrentUser, kind: ImportKind, rawName: string, buf: Uint8Array, storageRef?: string) {
  const filename = safeFilename(rawName);
  const hash = sha256(buf);
  const existing = kind === "seo" ? await findSeoVersionBySha(user.projectId, hash) : await findGeoBatchBySha(user.projectId, hash);
  if (existing) return { id: existing.id, duplicate: true };

  const issues = new IssueList();
  const markets = (await getMarkets(user.projectId)).map((m) => m.code);
  let workbook = null;
  if (precheckXlsx(buf, filename, issues)) workbook = await readWorkbook(buf, issues);
  const ref = storageRef ?? (await storeFile(kind, hash, buf));

  if (kind === "seo") {
    const parsed = workbook && !issues.hasErrors() ? parseSeoWorkbook(workbook, markets, issues) : { snapshot: null };
    const snapshot = parsed.snapshot;
    const before = await activeSummary(user.projectId);
    const summary = snapshot ? { markets: summarizeSnapshot(snapshot), previous: before.summary, previousVersionId: before.versionId } : null;
    const v = await createSeoVersion({ projectId: user.projectId, sha: hash, filename, storageUrl: ref, fileSize: buf.length, authorId: user.id, snapshot, summary, issues: issues.items });
    return { id: v.id, duplicate: false };
  }

  const parsed = workbook && !issues.hasErrors() ? parseGeoWorkbook(workbook, markets, issues) : { batch: null };
  let batch = parsed.batch;
  let summary: unknown = null;
  const [proj] = await db.select({ geoRevision: schema.projects.geoRevision }).from(schema.projects).where(eq(schema.projects.id, user.projectId));
  if (batch) {
    const plan = await planGeoBatch(user.projectId, batch);
    issues.items.push(...plan.conflicts);
    summary = geoSummary(batch, plan);
    if (plan.conflicts.some((c) => c.level === "error")) batch = null;
  }
  const b = await createGeoBatch({ projectId: user.projectId, sha: hash, filename, storageUrl: ref, fileSize: buf.length, authorId: user.id, batch, summary, issues: issues.items, baseRevision: proj.geoRevision });
  return { id: b.id, duplicate: false };
}

function geoSummary(batch: NonNullable<ReturnType<typeof parseGeoWorkbook>["batch"]>, plan: Awaited<ReturnType<typeof planGeoBatch>>) {
  return {
    market: batch.market, source: batch.source, collectedFrom: batch.collectedFrom, collectedTo: batch.collectedTo,
    questions: batch.questions.length, runs: batch.runs.length, errors: batch.runs.filter((r) => r.status === "error").length,
    citations: batch.runs.reduce((s, r) => s + r.citations.length, 0), platforms: [...new Set(batch.runs.map((r) => r.platform))],
    newQuestions: plan.newQuestions, newRuns: plan.newRuns, duplicateRuns: plan.duplicateRuns, statusChanges: plan.statusChanges, replacements: plan.replacements,
  };
}

/** Re-plans a validated GEO batch against current history after other GEO changes. */
export async function revalidateGeoBatch(projectId: number, batchId: number) {
  const [b] = await db.select().from(schema.geoBatches).where(eq(schema.geoBatches.id, batchId));
  if (!b || b.projectId !== projectId || b.status !== "validated" || !b.payload) return false;
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  const batch = b.payload as Parameters<typeof planGeoBatch>[1];
  const plan = await planGeoBatch(projectId, batch);
  const prevIssues = ((b.issues as Issue[]) ?? []).filter((i) => !i.code.startsWith("geo.run_") && !i.code.startsWith("geo.label_changed") && !i.code.startsWith("geo.replaces") && i.code !== "ref.question");
  const failed = plan.conflicts.some((c) => c.level === "error");
  await db.update(schema.geoBatches).set({
    baseRevision: p.geoRevision, summary: geoSummary(batch, plan), issues: [...prevIssues, ...plan.conflicts],
    status: failed ? "failed" : "validated", payload: failed ? null : b.payload,
  }).where(eq(schema.geoBatches.id, batchId));
  return true;
}
