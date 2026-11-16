import { jsonPrivate, requireApiUser } from "@/lib/auth/guard";
import { revalidateGeoBatch } from "@/lib/imports";

export async function POST(_req: Request, ctx: RouteContext<"/api/imports/[kind]/[id]/revalidate">) {
  const user = await requireApiUser("admin");
  if (user instanceof Response) return user;
  const { kind, id } = await ctx.params;
  if (kind !== "geo" || !/^\d+$/.test(id)) return jsonPrivate({ error: "not_found" }, { status: 404 });
  const ok = await revalidateGeoBatch(user.projectId, Number(id));
  return jsonPrivate({ ok }, { status: ok ? 200 : 409 });
}
