"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/lib/i18n";

export function QuestionActions({ market, questionId, status, labels }: { market: string; questionId: string; status: "active" | "archived"; labels: Dict["geo"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-ghost" disabled={busy} onClick={async () => {
      setBusy(true);
      await fetch("/api/geo/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ market, questionId, status: status === "active" ? "archived" : "active" }) });
      setBusy(false);
      router.refresh();
    }}>{status === "active" ? labels.archive : labels.reactivate}</button>
  );
}

export function InvalidateButton({ runId, labels }: { runId: string; labels: Dict["geo"] }) {
  const router = useRouter();
  return (
    <button className="btn-ghost text-xs" onClick={async () => {
      const reason = window.prompt(labels.invalidatePrompt);
      if (!reason?.trim()) return;
      await fetch("/api/geo/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, reason }) });
      router.refresh();
    }}>{labels.invalidate}</button>
  );
}
