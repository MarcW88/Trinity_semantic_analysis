import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { jsonPrivate, requireApiUser } from "@/lib/auth/guard";
import { IMPORT_LIMITS } from "@/lib/config";

/** Issues a short-lived token so admins upload workbooks directly to the private Blob store. */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody;
  if (body.type === "blob.generate-client-token") {
    const user = await requireApiUser("admin");
    if (user instanceof Response) return user;
  }
  try {
    const res = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!/^imports\/(seo|geo)\/[\w.-]+\.xlsx$/.test(pathname)) throw new Error("invalid pathname");
        return {
          allowedContentTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
          maximumSizeInBytes: IMPORT_LIMITS.maxFileBytes,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
      onUploadCompleted: async () => {},
    });
    return jsonPrivate(res);
  } catch {
    return jsonPrivate({ error: "upload_refused" }, { status: 400 });
  }
}
