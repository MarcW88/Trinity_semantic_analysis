"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import type { Dict } from "@/lib/i18n";

export function UploadForm({ kind, labels, blob }: { kind: "seo" | "geo"; labels: Dict["admin"]; blob: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      let res: Response;
      if (blob) {
        const safe = file.name.replace(/[^\w.-]+/g, "_").replace(/\.xlsx$/i, "") + ".xlsx";
        const b = await upload(`imports/${kind}/${safe}`, file, { access: "private", handleUploadUrl: "/api/imports/blob" });
        res = await fetch("/api/imports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, blobUrl: b.url, filename: file.name }) });
      } else {
        const fd = new FormData();
        fd.set("kind", kind); fd.set("file", file);
        res = await fetch("/api/imports", { method: "POST", body: fd });
      }
      const json = await res.json();
      if (!res.ok) { setMsg(json.error ?? String(res.status)); return; }
      if (json.duplicate) setMsg(labels.duplicate);
      router.push(`/admin/imports?kind=${kind}&id=${json.id}`);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`file-${kind}`}>{labels.choose}</label>
      <input id={`file-${kind}`} name="file" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="text-sm" />
      <button className="btn" type="submit" disabled={busy}>{busy ? labels.uploading : labels.send}</button>
      {msg && <p role="status" className="w-full text-sm text-amber-800">{msg}</p>}
    </form>
  );
}
