"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

export function PublishButton({ kind, id, expectedActive, rollback, labels }: { kind: "seo" | "geo"; id: number; expectedActive: number | null; rollback: boolean; labels: Dict["admin"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function go() {
    let reason: string | undefined;
    if (rollback) {
      reason = window.prompt(labels.rollbackReason) ?? undefined;
      if (!reason?.trim()) return;
    } else if (!window.confirm(labels.confirmPublish)) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/imports/${kind}/${id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedActive, reason, rollback }) });
    setBusy(false);
    if (res.status === 409) { setMsg(labels.conflict); return; }
    if (!res.ok) { setMsg(String(res.status)); return; }
    setMsg(labels.published);
    router.refresh();
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button className="btn" onClick={go} disabled={busy}>{rollback ? labels.rollback : labels.publish}</button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </span>
  );
}

export function RevalidateButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-ghost" disabled={busy} onClick={async () => { setBusy(true); await fetch(`/api/imports/geo/${id}/revalidate`, { method: "POST" }); setBusy(false); router.refresh(); }}>
      {label}
    </button>
  );
}
