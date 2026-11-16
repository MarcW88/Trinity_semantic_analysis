import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth, type Role } from "@/auth";
import { db, schema } from "@/lib/db";

export type CurrentUser = { id: number; email: string; name: string; role: Role; projectId: number };

/** Re-reads the user row so deactivated accounts and role changes apply immediately. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!id) return null;
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
  if (!u || !u.active) return null;
  return { id: u.id, email: u.email, name: u.name || u.email, role: u.role, projectId: u.projectId };
}

export async function requirePageUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role === "admin" && user.role !== "admin") redirect("/seo");
  return user;
}

export async function requireApiUser(role?: Role): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  if (role === "admin" && user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  return user;
}

export function jsonPrivate(body: unknown, init: ResponseInit = {}) {
  return NextResponse.json(body, { ...init, headers: { "Cache-Control": "private, no-store", ...(init.headers ?? {}) } });
}
