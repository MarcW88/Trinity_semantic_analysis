import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonPrivate, requireApiUser } from "@/lib/auth/guard";
import { processImport } from "@/lib/imports";
import { readStoredFile } from "@/lib/storage";
import { IMPORT_LIMITS } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

const blobBody = z.object({ kind: z.enum(["seo", "geo"]), blobUrl: z.string().url(), filename: z.string().min(1).max(200) });

/** Accepts either a multipart upload (local/dev, small files) or a reference to a private Blob uploaded by the client. */
export async function POST(req: NextRequest) {
  const user = await requireApiUser("admin");
  if (user instanceof Response) return user;
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > IMPORT_LIMITS.maxFileBytes + 64 * 1024) return jsonPrivate({ error: "file.too_large" }, { status: 413 });
    const form = await req.formData();
    const kind = form.get("kind");
    const file = form.get("file");
    if ((kind !== "seo" && kind !== "geo") || !(file instanceof File)) return jsonPrivate({ error: "bad_request" }, { status: 400 });
    if (file.size > IMPORT_LIMITS.maxFileBytes) return jsonPrivate({ error: "file.too_large" }, { status: 413 });
    const res = await processImport(user, kind, file.name, new Uint8Array(await file.arrayBuffer()));
    return jsonPrivate(res);
  }
  const parsed = blobBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonPrivate({ error: "bad_request" }, { status: 400 });
  const { kind, blobUrl, filename } = parsed.data;
  if (!blobUrl.includes(`/imports/${kind}/`)) return jsonPrivate({ error: "bad_request" }, { status: 400 });
  const buf = await readStoredFile(blobUrl, IMPORT_LIMITS.maxFileBytes);
  if (!buf) return jsonPrivate({ error: "file.too_large" }, { status: 413 });
  return jsonPrivate(await processImport(user, kind, filename, buf, blobUrl));
}
