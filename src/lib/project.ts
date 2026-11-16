import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "./db";

export async function getProject(projectId: number) {
  const [p] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
  if (!p) throw new Error("project not found");
  return p;
}

export async function getMarkets(projectId: number) {
  return db.select().from(schema.markets).where(eq(schema.markets.projectId, projectId)).orderBy(asc(schema.markets.sortOrder));
}

export async function logEvent(e: typeof schema.importEvents.$inferInsert) {
  await db.insert(schema.importEvents).values(e);
}
