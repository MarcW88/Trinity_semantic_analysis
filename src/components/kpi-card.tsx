"use client";
import type { ReactNode } from "react";
import { CountUp } from "./motion";

export function KpiCard({ label, value, format, suffix, help, children, accent = false }: {
  label: string; value: number | null; format: (n: number | null) => string; suffix?: string; help?: string; children?: ReactNode; accent?: boolean;
}) {
  return (
    <div className={`card card-hover flex h-full flex-col gap-1 ${accent ? "ring-1 ring-brand/20" : ""}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/50">{label}</span>
      <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">
        <CountUp value={value} format={format} />{suffix && <span className="text-lg font-medium text-ink/40">{suffix}</span>}
      </span>
      {help && <span className="text-xs text-ink/50">{help}</span>}
      {children}
    </div>
  );
}
