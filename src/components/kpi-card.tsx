import type { ReactNode } from "react";

export function KpiCard({ label, value, help, children }: { label: string; value: string; help?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums text-ink">{value}</span>
      {help && <span className="text-xs text-gray-500">{help}</span>}
      {children}
    </div>
  );
}
