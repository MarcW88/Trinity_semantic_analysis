"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BUCKET_COLORS } from "@/lib/config";
import { BUCKETS, type Bucket, type DomainInfo, type SeoResult } from "@/lib/seo/types";

const legendText = (v: string) => <span style={{ color: "#1f1f22" }}>{v}</span>;
const TOOLTIP = { borderRadius: 12, border: "1px solid #e6e6e9", boxShadow: "0 8px 24px -12px rgba(45,45,45,.25)", fontSize: 12 };

const MANY = 6;

export function DistributionChart({ data, labels }: { data: SeoResult["distribution"]; labels: Record<Bucket, string> }) {
  const rows = data.map((r) => ({ category: r.category, ...r.counts }));
  const horizontal = data.length > MANY;
  return (
    <div style={{ height: horizontal ? Math.max(288, rows.length * 28 + 40) : 288 }} role="img" aria-label={data.map((r) => `${r.category}: ${BUCKETS.map((b) => `${labels[b]} ${r.counts[b]}`).join(", ")}`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={rows} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ececef" vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? <>
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="category" width={190} interval={0} tick={{ fontSize: 11 }} />
          </> : <>
            <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          </>}
          <Tooltip contentStyle={TOOLTIP} />
          {BUCKETS.map((b) => <Bar key={b} dataKey={b} name={labels[b]} stackId="a" fill={BUCKET_COLORS[b]} animationDuration={900} radius={b === "unranked" ? (horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]) : 0} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VisibilityChart({ data, total, domains }: { data: SeoResult["visibility"]; total: number; domains: DomainInfo[] }) {
  const color = (d: string) => domains.find((x) => x.domain === d)?.color ?? "#6B7280";
  const rows = data.map((v) => ({ ...v, text: `${v.ranked}/${total}` }));
  return (
    <div style={{ height: Math.max(180, rows.length * 34) }} role="img" aria-label={rows.map((r) => `${r.label} ${r.text}`).join(", ")}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <XAxis type="number" allowDecimals={false} domain={[0, Math.max(1, total)]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`${v}/${total}`, ""]} />
          <Bar dataKey="ranked" radius={[0, 6, 6, 0]} animationDuration={900} label={{ position: "right", fontSize: 11, formatter: (v: unknown) => `${v}/${total}` }}>
            {rows.map((r) => <Cell key={r.domain} fill={color(r.domain)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VisibilityByCategoryChart({ data, domains }: { data: SeoResult["visibilityByCategory"]; domains: DomainInfo[] }) {
  if (data.length > MANY) return <VisibilityByCategoryTable data={data} />;
  const labels = [...new Set(data.flatMap((c) => c.rates.map((r) => r.label)))];
  const colorOf = (label: string) => domains.find((x) => x.label === label)?.color ?? "#6B7280";
  const rows = data.map((c) => ({ category: c.category, ...Object.fromEntries(c.rates.map((r) => [r.label, r.rate === null ? 0 : Math.round(r.rate * 1000) / 10])) }));
  return (
    <div className="h-72" role="img" aria-label={data.map((c) => `${c.category}: ${c.rates.map((r) => `${r.label} ${r.rate === null ? "—" : (r.rate * 100).toFixed(1) + "%"}`).join(", ")}`).join("; ")}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ececef" vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} interval={0} />
          <YAxis unit="%" tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={TOOLTIP} formatter={(v) => `${v} %`} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText} />
          {labels.map((l) => <Bar key={l} dataKey={l} fill={colorOf(l)} radius={[4, 4, 0, 0]} animationDuration={900} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Category × actor heatmap of Top 10 rates, used when a bar chart would be unreadable. */
function VisibilityByCategoryTable({ data }: { data: SeoResult["visibilityByCategory"] }) {
  const cols = [...new Set(data.flatMap((c) => c.rates.map((r) => r.label)))];
  return (
    <div className="max-h-96 overflow-auto">
      <table className="tbl">
        <thead className="sticky top-0 z-10"><tr><th scope="col" />{cols.map((l) => <th key={l} scope="col" className="num">{l}</th>)}</tr></thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.categoryId}>
              <td className="whitespace-nowrap">{c.category}</td>
              {cols.map((l) => {
                const r = c.rates.find((x) => x.label === l);
                const v = r?.rate ?? null;
                return <td key={l} className="num" style={{ background: v ? `rgba(234, 51, 35, ${0.08 + v * 0.7})` : undefined, color: v && v > 0.5 ? "#fff" : undefined }}>{v === null ? "—" : `${(v * 100).toFixed(1)} %`}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Donut({ data, format }: { data: { name: string; value: number; color: string }[]; format: (n: number) => string }) {
  const total = data.reduce((s, x) => s + x.value, 0);
  return (
    <div className="h-56" role="img" aria-label={data.map((x) => `${x.name}: ${format(x.value)}`).join(", ")}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} cornerRadius={4} animationDuration={900}
            label={({ value, x, y, textAnchor }) => (total ? <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill="#1f1f22" fontSize={12} fontWeight={600}>{`${((Number(value) / total) * 100).toFixed(1)}%`}</text> : null)}>
            {data.map((x) => <Cell key={x.name} fill={x.color} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP} formatter={(v) => format(Number(v))} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendText} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
