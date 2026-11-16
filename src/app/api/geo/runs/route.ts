import { z } from "zod";
import { jsonPrivate, requireApiUser } from "@/lib/auth/guard";
import { invalidateRun } from "@/lib/geo/repo";

const body = z.object({ runId: z.string().min(1).max(200), reason: z.string().trim().min(1).max(500) });

export async function POST(req: Request) {
  const user = await requireApiUser("admin");
  if (user instanceof Response) return user;
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return jsonPrivate({ error: "bad_request" }, { status: 400 });
  const ok = await invalidateRun(user.projectId, p.data.runId, p.data.reason, user.id);
  return jsonPrivate({ ok }, { status: ok ? 200 : 404 });
}
