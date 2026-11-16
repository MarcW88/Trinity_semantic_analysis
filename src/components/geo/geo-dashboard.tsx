"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GeoResult } from "@/lib/geo/compute";
import type { GeoFilters } from "@/lib/geo/types";
import { makeFormat, t, type Dict } from "@/lib/i18n";
import type { UiLang } from "@/lib/config";
import { KpiCard } from "../kpi-card";

const COLORS = ["#8B7355", "#4A90A4", "#7A9E7E", "#C4956A", "#9C8AA5", "#D4A87C"];
type Props = { market: string; marketLabel: string; filters: GeoFilters; result: GeoResult; categories: string[]; brand: string; client: string; d: Dict; lang: UiLang };

export function GeoDashboard({ market, marketLabel, filters, result, categories, brand, client, d, lang }: Props) {
  const g = d.geo;
  const f = useMemo(() => makeFormat(lang), [lang]);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "archived">("active");
  const [brandF, setBrandF] = useState<"all" | "present" | "absent">("all");
  const [sort, setSort] = useState<{ key: "question" | "valid" | "presenceRate" | "citationRate" | "lastObservedAt"; dir: 1 | -1 }>({ key: "question", dir: 1 });
  const c = result.cards;

  const setParam = (k: string, v: string) => start(() => {
    const next = new URLSearchParams(params.toString());
    next.set("market", market);
    if (!v || v === "all" || (k === "g" && v === "week")) next.delete(k); else next.set(k, v);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  });

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return result.questions
      .filter((x) => (status === "all" || x.status === status) && (brandF === "all" || (brandF === "present") === x.brandPresent))
      .filter((x) => !needle || x.question.toLowerCase().includes(needle) || x.questionId.toLowerCase().includes(needle))
      .sort((a, b) => {
        const va = a[sort.key], vb = b[sort.key];
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
      });
  }, [result.questions, q, status, brandF, sort]);

  const th = (key: typeof sort.key, label: string, num = false) => (
    <th scope="col" className={num ? "num" : ""} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="hover:underline" onClick={() => setSort({ key, dir: sort.key === key ? (sort.dir === 1 ? -1 : 1) : 1 })}>
        {label}{sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );
  const exportHref = `/api/geo/export?${new URLSearchParams({ ...Object.fromEntries(params.entries()), market, status, brand: brandF, q }).toString()}`;

  return (
    <div className={`space-y-8 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div>
        <h1 className="text-2xl font-semibold">{g.title}</h1>
        <p className="text-sm text-gray-600">{marketLabel} · {g.tz}</p>
      </div>
      <div className="card flex flex-wrap items-end gap-3 text-sm">
        <label>{g.from}<input type="date" className="input ml-2" value={filters.from ?? ""} onChange={(e) => setParam("from", e.target.value)} /></label>
        <label>{g.to}<input type="date" className="input ml-2" value={filters.to ?? ""} onChange={(e) => setParam("to", e.target.value)} /></label>
        <label>{g.platform}
          <select className="select ml-2" value={filters.platform} onChange={(e) => setParam("platform", e.target.value)}>
            <option value="all">{d.common.all}</option>{result.platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>{g.webSearch}
          <select className="select ml-2" value={filters.webSearch} onChange={(e) => setParam("web", e.target.value)}>
            {(["all", "on", "off", "unknown"] as const).map((w) => <option key={w} value={w}>{g.ws[w]}</option>)}
          </select>
        </label>
        <label>{d.common.category}
          <select className="select ml-2" value={filters.category} onChange={(e) => setParam("category", e.target.value)}>
            <option value="all">{d.common.all}</option>{categories.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label>{g.granularity}
          <select className="select ml-2" value={filters.granularity} onChange={(e) => setParam("g", e.target.value)}>
            <option value="week">{g.week}</option><option value="month">{g.month}</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={g.tracked} value={f.int(c.tracked)} />
        <KpiCard label={g.observed} value={f.int(c.observed)} />
        <KpiCard label={g.valid} value={f.int(c.valid)} help={t(g.validHelp, { runs: f.int(c.runs), errors: f.int(c.errors) })} />
        <KpiCard label={g.presence} value={f.pct(c.presenceRate)} help={t(g.presenceHelp, { n: f.int(c.present), brand })} />
        <KpiCard label={g.citation} value={f.pct(c.citationRate)} help={t(g.citationHelp, { n: f.int(c.cited), brand })} />
      </div>

      <section aria-labelledby="evo">
        <h2 id="evo" className="section-title">{g.evolution}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["presence", "citation"] as const).map((kind) => (
            <div key={kind} className="card">
              <h3 className="mb-2 text-sm font-semibold">{kind === "presence" ? g.presenceSeries : g.citationSeries}</h3>
              <div className="h-64" role="img" aria-label={result.timeline.map((r) => `${r.period}: ${result.shownPlatforms.map((p) => `${p} ${r[`${kind}:${p}`] === null ? "—" : f.pct(Number(r[`${kind}:${p}`]))}`).join(", ")}`).join("; ")}>
                <ResponsiveContainer>
                  <LineChart data={result.timeline} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => (v === null || v === undefined ? "—" : f.pct(Number(v)))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {result.shownPlatforms.map((p, i) => (
                      <Line key={p} dataKey={`${kind}:${p}`} name={p} stroke={COLORS[i % COLORS.length]} connectNulls={false} dot isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-600">{g.noValid}</p>
      </section>

      <section aria-labelledby="ql">
        <h2 id="ql" className="section-title">{g.questions}</h2>
        <div className="mb-3 flex flex-wrap items-end gap-3 text-sm">
          <label>{d.common.search}<input type="search" className="input ml-2" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label>{g.statusF}
            <select className="select ml-2" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="all">{d.common.all}</option><option value="active">{g.active}</option><option value="archived">{g.archived}</option>
            </select>
          </label>
          <label>{g.brandF}
            <select className="select ml-2" value={brandF} onChange={(e) => setBrandF(e.target.value as typeof brandF)}>
              <option value="all">{d.common.all}</option><option value="present">{g.brandPresent}</option><option value="absent">{g.brandAbsent}</option>
            </select>
          </label>
          <span aria-live="polite" className="text-gray-600">{t(d.common.rows, { n: list.length })}</span>
          <a className="btn ml-auto" href={exportHref} download>{d.common.exportCsv}</a>
        </div>
        {list.length === 0 ? <p className="text-sm text-gray-600">{g.noQuestions}</p> : (
          <div className="card max-h-[600px] overflow-auto p-0">
            <table className="tbl">
              <thead className="sticky top-0"><tr>
                {th("question", g.qcol.question)}<th scope="col">{g.qcol.status}</th>{th("valid", g.qcol.valid, true)}
                {th("presenceRate", g.qcol.presence, true)}{th("citationRate", g.qcol.citation, true)}<th scope="col">{g.qcol.platforms}</th>{th("lastObservedAt", g.qcol.last)}
              </tr></thead>
              <tbody>
                {list.map((x) => (
                  <tr key={x.questionId}>
                    <td><Link className="text-brown underline" href={`/geo/q/${market}/${encodeURIComponent(x.questionId)}`}>{x.question}</Link><div className="text-xs text-gray-500">{x.questionId} · v{x.version}</div></td>
                    <td>{x.status === "active" ? g.active : g.archived}</td>
                    <td className="num">{f.int(x.valid)}{x.errors > 0 && <span className="text-xs text-red-700"> (+{x.errors})</span>}</td>
                    <td className="num">{f.pct(x.presenceRate)}</td><td className="num">{f.pct(x.citationRate)}</td>
                    <td>{x.platforms.join(", ")}</td><td>{f.dateTime(x.lastObservedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <footer className="border-t border-line pt-3 text-xs text-gray-500">{t(d.common.footer, { client, view: `GEO ${marketLabel}`, date: f.dateTime(result.questions.map((x) => x.lastObservedAt).filter(Boolean).sort().pop() ?? null) })}</footer>
    </div>
  );
}
