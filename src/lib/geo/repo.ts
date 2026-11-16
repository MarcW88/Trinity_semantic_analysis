import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";
import type { Issue } from "../issues";
import type { GeoBatch, GeoQuestionInfo, GeoRunInfo } from "./types";

export class GeoConflictError extends Error {}

/** Splits IN (...) lists to stay under PostgreSQL's 65,535 bind-parameter limit. */
async function inChunks<T, R>(ids: T[], query: (part: T[]) => Promise<R[]>, size = 10_000): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < ids.length; i += size) out.push(...(await query(ids.slice(i, i + size))));
  return out;
}

export type GeoPlan = {
  newQuestions: number; newRuns: number; duplicateRuns: number; statusChanges: number;
  replacements: number; conflicts: Issue[];
};

/** Compares a parsed batch with stored history: idempotent re-imports, changed runs, label versions. */
export async function planGeoBatch(projectId: number, batch: GeoBatch): Promise<GeoPlan> {
  const conflicts: Issue[] = [];
  const qids = [...new Set([...batch.questions.map((q) => q.questionId), ...batch.runs.map((r) => r.questionId)])];
  const existingQ = await inChunks(qids, (part) =>
    db.select().from(schema.geoQuestions).where(and(eq(schema.geoQuestions.projectId, projectId), eq(schema.geoQuestions.market, batch.market), inArray(schema.geoQuestions.questionId, part))));
  const qByKey = new Map(existingQ.map((q) => [`${q.questionId}|${q.questionVersion}`, q]));
  let newQuestions = 0;
  for (const q of batch.questions) {
    const ex = qByKey.get(`${q.questionId}|${q.questionVersion}`);
    if (!ex) newQuestions++;
    else if (ex.question !== q.question) conflicts.push({ level: "error", code: "geo.label_changed", sheet: "Questions", field: "question", value: `${q.questionId} v${q.questionVersion}` });
  }
  const batchKeys = new Set(batch.questions.map((q) => `${q.questionId}|${q.questionVersion}`));
  for (const r of batch.runs) {
    const key = `${r.questionId}|${r.questionVersion}`;
    if (!batchKeys.has(key) && !qByKey.has(key)) conflicts.push({ level: "error", code: "ref.question", sheet: "Runs", field: "question_id", value: `${r.questionId} v${r.questionVersion}` });
  }
  const states = await inChunks(qids, (part) =>
    db.select().from(schema.geoQuestionStates).where(and(eq(schema.geoQuestionStates.projectId, projectId), eq(schema.geoQuestionStates.market, batch.market), inArray(schema.geoQuestionStates.questionId, part))));
  const stateBy = new Map(states.map((s) => [s.questionId, s.status]));
  let statusChanges = 0;
  for (const [qid, status] of latestStatuses(batch)) if (stateBy.get(qid) !== status) statusChanges++;

  const runIds = batch.runs.map((r) => r.runId);
  const existingRuns = await inChunks(runIds, (part) =>
    db.select({ runId: schema.geoRuns.runId, market: schema.geoRuns.market, contentHash: schema.geoRuns.contentHash }).from(schema.geoRuns).where(and(eq(schema.geoRuns.projectId, projectId), inArray(schema.geoRuns.runId, part))));
  const existingBy = new Map(existingRuns.map((r) => [r.runId, r]));
  let newRuns = 0, duplicateRuns = 0, replacements = 0;
  const replaced = batch.runs.map((r) => r.replacesRunId).filter((x): x is string => Boolean(x));
  const replacedRows = await inChunks(replaced, (part) =>
    db.select({ runId: schema.geoRuns.runId, invalidatedAt: schema.geoRuns.invalidatedAt }).from(schema.geoRuns).where(and(eq(schema.geoRuns.projectId, projectId), inArray(schema.geoRuns.runId, part))));
  for (const r of batch.runs) {
    const ex = existingBy.get(r.runId);
    if (!ex) newRuns++;
    else if (ex.market !== batch.market) conflicts.push({ level: "error", code: "geo.run_other_market", sheet: "Runs", field: "run_id", value: r.runId, params: { market: ex.market } });
    else if (ex.contentHash === r.contentHash) duplicateRuns++;
    else conflicts.push({ level: "error", code: "geo.run_changed", sheet: "Runs", field: "run_id", value: r.runId });
    if (r.replacesRunId && !ex) {
      const target = replacedRows.find((x) => x.runId === r.replacesRunId);
      if (!target) conflicts.push({ level: "error", code: "geo.replaces_unknown", sheet: "Runs", field: "replaces_run_id", value: r.replacesRunId });
      else if (!target.invalidatedAt) conflicts.push({ level: "error", code: "geo.replaces_not_invalidated", sheet: "Runs", field: "replaces_run_id", value: r.replacesRunId });
      else replacements++;
    }
  }
  return { newQuestions, newRuns, duplicateRuns, statusChanges, replacements, conflicts };
}

function latestStatuses(batch: GeoBatch): Map<string, "active" | "archived"> {
  const best = new Map<string, { v: number; s: "active" | "archived" }>();
  for (const q of batch.questions) {
    const b = best.get(q.questionId);
    if (!b || q.questionVersion > b.v) best.set(q.questionId, { v: q.questionVersion, s: q.status });
  }
  return new Map([...best].map(([k, v]) => [k, v.s]));
}

export async function findGeoBatchBySha(projectId: number, sha: string) {
  const [b] = await db.select().from(schema.geoBatches).where(and(eq(schema.geoBatches.projectId, projectId), eq(schema.geoBatches.sha256, sha)));
  return b ?? null;
}

export async function createGeoBatch(input: {
  projectId: number; sha: string; filename: string; storageUrl: string | null; fileSize: number; authorId: number;
  batch: GeoBatch | null; summary: unknown; issues: Issue[]; baseRevision: number;
}) {
  const [b] = await db.insert(schema.geoBatches).values({
    projectId: input.projectId, status: input.batch ? "validated" : "failed", sha256: input.sha, filename: input.filename,
    storageUrl: input.storageUrl, fileSize: input.fileSize, baseRevision: input.baseRevision, payload: input.batch, summary: input.summary,
    issues: input.issues.slice(0, 1000), authorId: input.authorId,
  }).returning();
  await db.insert(schema.importEvents).values({ projectId: input.projectId, kind: "geo", action: input.batch ? "validated" : "failed", refId: b.id, actorId: input.authorId, details: { filename: input.filename, sha256: input.sha } });
  return b;
}

/** Publishes a validated batch in one transaction; rejects if GEO data changed since validation. */
export async function publishGeoBatch(projectId: number, batchId: number, actorId: number) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)).for("update");
    const [b] = await tx.select().from(schema.geoBatches).where(and(eq(schema.geoBatches.id, batchId), eq(schema.geoBatches.projectId, projectId)));
    if (!b || b.status !== "validated" || !b.payload) throw new GeoConflictError("not_publishable");
    if (b.baseRevision !== p.geoRevision) throw new GeoConflictError("active_changed");
    const batch = b.payload as GeoBatch;
    for (const q of batch.questions) {
      await tx.insert(schema.geoQuestions).values({ projectId, market: batch.market, ...q, batchId }).onConflictDoNothing();
    }
    for (const [qid, status] of latestStatuses(batch)) {
      await tx.insert(schema.geoQuestionStates).values({ projectId, market: batch.market, questionId: qid, status, updatedBy: actorId })
        .onConflictDoUpdate({ target: [schema.geoQuestionStates.projectId, schema.geoQuestionStates.market, schema.geoQuestionStates.questionId], set: { status, updatedAt: new Date(), updatedBy: actorId } });
    }
    let inserted = 0;
    for (const r of batch.runs) {
      const { citations, ...run } = r;
      const [row] = await tx.insert(schema.geoRuns).values({ projectId, market: batch.market, ...run, observedAt: new Date(run.observedAt), batchId })
        .onConflictDoNothing().returning({ id: schema.geoRuns.id });
      if (!row) continue;
      inserted++;
      if (citations.length) await tx.insert(schema.geoCitations).values(citations.map((c) => ({ runPk: row.id, ...c })));
    }
    await tx.update(schema.projects).set({ geoRevision: p.geoRevision + 1 }).where(eq(schema.projects.id, projectId));
    await tx.update(schema.geoBatches).set({ status: "published", publishedAt: new Date(), publishedBy: actorId }).where(eq(schema.geoBatches.id, batchId));
    await tx.insert(schema.importEvents).values({ projectId, kind: "geo", action: "published", refId: batchId, actorId, details: { market: batch.market, runsInserted: inserted } });
    return { inserted };
  });
}

export async function listGeoBatches(projectId: number) {
  return db.select({
    id: schema.geoBatches.id, status: schema.geoBatches.status, filename: schema.geoBatches.filename, sha256: schema.geoBatches.sha256,
    summary: schema.geoBatches.summary, createdAt: schema.geoBatches.createdAt, publishedAt: schema.geoBatches.publishedAt, authorEmail: schema.users.email,
  }).from(schema.geoBatches).leftJoin(schema.users, eq(schema.users.id, schema.geoBatches.authorId))
    .where(eq(schema.geoBatches.projectId, projectId)).orderBy(desc(schema.geoBatches.id)).limit(100);
}

export async function getGeoBatch(projectId: number, id: number) {
  const [b] = await db.select().from(schema.geoBatches).where(and(eq(schema.geoBatches.projectId, projectId), eq(schema.geoBatches.id, id)));
  return b ?? null;
}

export async function loadGeoMarket(projectId: number, market: string): Promise<{ questions: GeoQuestionInfo[]; runs: GeoRunInfo[] }> {
  const [qs, states, runs, cites] = await Promise.all([
    db.select().from(schema.geoQuestions).where(and(eq(schema.geoQuestions.projectId, projectId), eq(schema.geoQuestions.market, market))),
    db.select().from(schema.geoQuestionStates).where(and(eq(schema.geoQuestionStates.projectId, projectId), eq(schema.geoQuestionStates.market, market))),
    db.select().from(schema.geoRuns).where(and(eq(schema.geoRuns.projectId, projectId), eq(schema.geoRuns.market, market))),
    db.select({ runPk: schema.geoCitations.runPk, citedUrl: schema.geoCitations.citedUrl, host: schema.geoCitations.host, citationOrder: schema.geoCitations.citationOrder })
      .from(schema.geoCitations).innerJoin(schema.geoRuns, eq(schema.geoRuns.id, schema.geoCitations.runPk))
      .where(and(eq(schema.geoRuns.projectId, projectId), eq(schema.geoRuns.market, market))),
  ]);
  const citesBy = new Map<number, typeof cites>();
  for (const c of cites) citesBy.set(c.runPk, [...(citesBy.get(c.runPk) ?? []), c]);
  const stateBy = new Map(states.map((s) => [s.questionId, s.status]));
  const byId = new Map<string, GeoQuestionInfo>();
  for (const q of qs) {
    const info = byId.get(q.questionId) ?? { questionId: q.questionId, status: stateBy.get(q.questionId) ?? "active", categoryId: null, versions: [] };
    info.versions.push({ version: q.questionVersion, question: q.question, createdAt: q.createdAt.toISOString() });
    const latest = Math.max(...info.versions.map((v) => v.version));
    if (q.questionVersion === latest) info.categoryId = q.categoryId;
    byId.set(q.questionId, info);
  }
  return {
    questions: [...byId.values()].map((q) => ({ ...q, versions: q.versions.sort((a, b) => a.version - b.version) })),
    runs: runs.map((r) => ({
      runId: r.runId, questionId: r.questionId, questionVersion: r.questionVersion, observedAt: r.observedAt.toISOString(), platform: r.platform,
      model: r.model, webSearch: r.webSearch, status: r.status, brandMentioned: r.brandMentioned, answerText: r.answerText, errorCode: r.errorCode,
      citations: (citesBy.get(r.id) ?? []).sort((a, b) => (a.citationOrder ?? 0) - (b.citationOrder ?? 0)).map((c) => ({ citedUrl: c.citedUrl, host: c.host, citationOrder: c.citationOrder })),
      invalidatedAt: r.invalidatedAt?.toISOString() ?? null, invalidReason: r.invalidReason, replacesRunId: r.replacesRunId,
    })),
  };
}

export async function setQuestionStatus(projectId: number, market: string, questionId: string, status: "active" | "archived", actorId: number) {
  return db.transaction(async (tx) => {
    const [q] = await tx.select({ id: schema.geoQuestions.id }).from(schema.geoQuestions).where(and(eq(schema.geoQuestions.projectId, projectId), eq(schema.geoQuestions.market, market), eq(schema.geoQuestions.questionId, questionId))).limit(1);
    if (!q) return false;
    await tx.insert(schema.geoQuestionStates).values({ projectId, market, questionId, status, updatedBy: actorId })
      .onConflictDoUpdate({ target: [schema.geoQuestionStates.projectId, schema.geoQuestionStates.market, schema.geoQuestionStates.questionId], set: { status, updatedAt: new Date(), updatedBy: actorId } });
    await tx.update(schema.projects).set({ geoRevision: sql`${schema.projects.geoRevision} + 1` }).where(eq(schema.projects.id, projectId));
    await tx.insert(schema.importEvents).values({ projectId, kind: "geo", action: status === "archived" ? "archived" : "reactivated", actorId, details: { market, questionId } });
    return true;
  });
}

export async function invalidateRun(projectId: number, runId: string, reason: string, actorId: number) {
  return db.transaction(async (tx) => {
    const [r] = await tx.update(schema.geoRuns).set({ invalidatedAt: new Date(), invalidatedBy: actorId, invalidReason: reason })
      .where(and(eq(schema.geoRuns.projectId, projectId), eq(schema.geoRuns.runId, runId), sql`${schema.geoRuns.invalidatedAt} is null`)).returning({ id: schema.geoRuns.id });
    if (!r) return false;
    await tx.update(schema.projects).set({ geoRevision: sql`${schema.projects.geoRevision} + 1` }).where(eq(schema.projects.id, projectId));
    await tx.insert(schema.importEvents).values({ projectId, kind: "geo", action: "invalidated", refId: r.id, actorId, reason, details: { runId } });
    return true;
  });
}
