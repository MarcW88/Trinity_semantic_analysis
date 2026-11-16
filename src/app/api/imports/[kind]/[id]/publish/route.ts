import { z } from "zod";
import { jsonPrivate, requireApiUser } from "@/lib/auth/guard";
import { ConflictError, publishSeoVersion } from "@/lib/seo/repo";
import { GeoConflictError, publishGeoBatch } from "@/lib/geo/repo";

const body = z.object({ expectedActive: z.number().int().nullable().optional(), reason: z.string().trim().max(500).optional(), rollback: z.boolean().optional() });

export async function POST(req: Request, ctx: RouteContext<"/api/imports/[kind]/[id]/publish">) {
  const user = await requireApiUser("admin");
  if (user instanceof Response) return user;
  const { kind, id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || !/^\d+$/.test(id)) return jsonPrivate({ error: "bad_request" }, { status: 400 });
  try {
    if (kind === "seo") {
      const rollback = parsed.data.rollback === true;
      if (rollback && !parsed.data.reason) return jsonPrivate({ error: "reason_required" }, { status: 400 });
      await publishSeoVersion(user.projectId, Number(id), parsed.data.expectedActive ?? null, user.id, rollback ? "rollback" : "published", parsed.data.reason ?? null);
    } else if (kind === "geo") {
      await publishGeoBatch(user.projectId, Number(id), user.id);
    } else return jsonPrivate({ error: "not_found" }, { status: 404 });
    return jsonPrivate({ ok: true });
  } catch (e) {
    if (e instanceof ConflictError || e instanceof GeoConflictError) return jsonPrivate({ error: e.message }, { status: 409 });
    throw e;
  }
}
