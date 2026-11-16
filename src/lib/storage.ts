import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, put } from "@vercel/blob";

export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const LOCAL_DIR = process.env.LOCAL_STORAGE_DIR ?? join(/*turbopackIgnore: true*/ process.cwd(), "storage");

export function sha256(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** Stores an uploaded workbook privately; returns a storage reference (blob URL or local path). */
export async function storeFile(kind: string, hash: string, buf: Uint8Array): Promise<string> {
  const name = `imports/${kind}/${hash}.xlsx`;
  if (blobEnabled()) {
    const res = await put(name, Buffer.from(buf), { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    return res.url;
  }
  const path = join(LOCAL_DIR, name);
  await mkdir(join(LOCAL_DIR, "imports", kind), { recursive: true });
  await writeFile(path, buf);
  return `local:${name}`;
}

export async function readStoredFile(ref: string, maxBytes: number): Promise<Uint8Array | null> {
  if (ref.startsWith("local:")) {
    try { return new Uint8Array(await readFile(join(LOCAL_DIR, ref.slice(6)))); } catch { return null; }
  }
  const res = await get(ref, { access: "private", useCache: false });
  if (!res || res.statusCode !== 200) return null;
  if (res.blob.size > maxBytes) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}
