"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUCKET_COLORS } from "@/lib/config";
import { BUCKETS, type Bucket, type DomainInfo, type SeoResult } from "@/lib/seo/types";

export function DistributionChart({ data, labels }: { data: SeoResult["distribution"]; labels: Record<Bucket, string> }) {
  const rows = data.map((r) => ({ category: r.category, ...r.counts }));
  return (
    <div className="h-72" role="img" aria-label={data.map((r) => `${r.category}: ${BUCKETS.map((b) => `${labels[b]} ${r.counts[b]}`).join(", ")}`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          {BUCKETS.map((b) => <Bar key={b} dataKey={b} name={labels[b]} stackId="a" fill={BUCKET_COLORS[b]} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VisibilityChart({ data, total, domains }: { data: SeoResult["visibility"]; total: number; domains: DomainInfo[] }) {
  const color = (d: string) => domains.find((x) => x.domain === d)?.color ?? "#B8A99A";
  const rows = data.map((v) => ({ ...v, text: `${v.ranked}/${total}` }));
  return (
    <div style={{ height: Math.max(180, rows.length * 34) }} role="img" aria-label={rows.map((r) => `${r.label} ${r.text}`).join(", ")}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} domain={[0, Math.max(1, total)]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => [`${v}/${total}`, ""]} />
          <Bar dataKey="ranked" label={{ position: "right", fontSize: 11, formatter: (v: unknown) => `${v}/${total}` }}>
            {rows.map((r) => <Cell key={r.domain} fill={color(r.domain)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VisibilityByCategoryChart({ data, domains }: { data: SeoResult["visibilityByCategory"]; domains: DomainInfo[] }) {
  const labels = [...new Set(data.flatMap((c) => c.rates.map((r) => r.label)))];
  const colorOf = (label: string) => domains.find((x) => x.label === label)?.color ?? "#B8A99A";
  const rows = data.map((c) => ({ category: c.category, ...Object.fromEntries(c.rates.map((r) => [r.label, r.rate === null ? 0 : Math.round(r.rate * 1000) / 10])) }));
  return (
    <div className="h-72" role="img" aria-label={data.map((c) => `${c.category}: ${c.rates.map((r) => `${r.label} ${r.rate === null ? "—" : (r.rate * 100).toFixed(1) + "%"}`).join(", ")}`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} />
          <YAxis unit="%" tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => `${v} %`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {labels.map((l) => <Bar key={l} dataKey={l} fill={colorOf(l)} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, format }: { data: { name: string; value: number; color: string }[]; format: (n: number) => string }) {
  const total = data.reduce((s, x) => s + x.value, 0);
  return (
    <div className="h-56" role="img" aria-label={data.map((x) => `${x.name}: ${format(x.value)}`).join(", ")}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={1}
            label={({ value }) => (total ? `${((Number(value) / total) * 100).toFixed(1)}%` : "")}>
            {data.map((x) => <Cell key={x.name} fill={x.color} />)}
          </Pie>
          <Tooltip formatter={(v) => format(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
