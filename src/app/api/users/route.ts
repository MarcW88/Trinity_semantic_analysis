import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { jsonPrivate, requireApiUser } from "@/lib/auth/guard";
import { db, schema } from "@/lib/db";

const createBody = z.object({ action: z.literal("create"), email: z.string().email().max(200), name: z.string().max(100).default(""), role: z.enum(["admin", "viewer"]), password: z.string().min(10).max(200) });
const updateBody = z.object({ action: z.literal("update"), id: z.number().int(), active: z.boolean().optional(), role: z.enum(["admin", "viewer"]).optional(), password: z.string().min(10).max(200).optional() });

export async function POST(req: Request) {
  const user = await requireApiUser("admin");
  if (user instanceof Response) return user;
  const raw = await req.json().catch(() => null);
  const c = createBody.safeParse(raw);
  if (c.success) {
    const email = c.data.email.trim().toLowerCase();
    const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (exists) return jsonPrivate({ error: "exists" }, { status: 409 });
    await db.insert(schema.users).values({ projectId: user.projectId, email, name: c.data.name, role: c.data.role, passwordHash: await bcrypt.hash(c.data.password, 12) });
    return jsonPrivate({ ok: true });
  }
  const u = updateBody.safeParse(raw);
  if (!u.success) return jsonPrivate({ error: "bad_request" }, { status: 400 });
  if (u.data.id === user.id) return jsonPrivate({ error: "self" }, { status: 400 });
  const set: PgUpdateSetSource<typeof schema.users> = {};
  if (u.data.active !== undefined) set.active = u.data.active;
  if (u.data.role) set.role = u.data.role;
  if (u.data.password) Object.assign(set, { passwordHash: await bcrypt.hash(u.data.password, 12), failedLogins: 0, lockedUntil: null });
  if (u.data.password || u.data.active === false) set.sessionVersion = sql`${schema.users.sessionVersion} + 1`;
  await db.update(schema.users).set(set).where(and(eq(schema.users.id, u.data.id), eq(schema.users.projectId, user.projectId)));
  return jsonPrivate({ ok: true });
}
