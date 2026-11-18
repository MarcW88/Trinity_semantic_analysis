"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Benchmark } from "@/lib/seo/benchmark";
import { makeFormat, t, type Dict } from "@/lib/i18n";
import { BUCKET_COLORS, COMPETITOR_COLORS, POSITION_COLORS, type UiLang } from "@/lib/config";
import { positionTone } from "@/lib/seo/compute";
import { toCsv } from "@/lib/csv";
import { ChipFilter, CountUp, Reveal, Segmented } from "../motion";
import { InfoTip } from "../info-tip";
import { SerpLeaders, type KeywordMeta } from "./serp-leaders";

const TOOLTIP = { borderRadius: 12, border: "1px solid #e6e6e9", boxShadow: "0 8px 24px -12px rgba(31,31,34,.25)", fontSize: 12 };
const RANGES = ["top3", "4-10", "11-20"] as const;
const PAGE = 200;
const CARDS = 3;

type Props = { bench: Benchmark; tracked: Record<string, number>; trackedTotal: number; keywordMeta: KeywordMeta; marketLabel: string; d: Dict; lang: UiLang };

export function BenchmarkView({ bench, tracked, trackedTotal, keywordMeta, marketLabel, d, lang }: Props) {
  const b = d.bench;
  const f = useMemo(() => makeFormat(lang), [lang]);
  const domains = useMemo(() => [...bench.domains].sort((x, y) => y.traffic - x.traffic), [bench.domains]);
  const color = (domain: string) => COMPETITOR_COLORS[bench.domains.findIndex((x) => x.domain === domain) % COMPETITOR_COLORS.length];
  const [selected, setSelected] = useState(domains[0].domain);
  const defaultCards = useMemo(() => domains.slice(0, CARDS).map((x) => x.domain), [domains]);
  const [cards, setCards] = useState(defaultCards);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [scope, setScope] = useState<"all" | "tracked" | "other">("all");
  const current = domains.find((x) => x.domain === selected) ?? domains[0];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return current.keywords.filter((k) => (scope === "all" || (scope === "tracked") === !!k.tracked)
      && (!q || k.keyword.toLowerCase().includes(q) || k.url.toLowerCase().includes(q)));
  }, [current, query, scope]);
  const trackedHits = Object.values(tracked).reduce((s, n) => s + n, 0);

  const trafficData = domains.map((x) => ({ domain: x.domain, ...x.trafficByRange }));
  const kwData = domains.map((x) => ({ domain: x.domain, [b.keywords]: x.total, [b.top10]: x.top10, [b.tracked]: tracked[x.domain] ?? 0 }));

  const exportCsv = () => {
    const csv = toCsv([b.col.keyword, b.col.position, b.col.volume, b.col.traffic, b.col.url], rows.map((k) => [k.keyword, k.position, k.volume, k.traffic, k.url]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `benchmark_${bench.market}_${current.domain}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-10">
      <Reveal>
        <div className="hero">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{marketLabel}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{b.title}</h1>
            <p className="mt-1 text-sm text-white/80">{t(b.subtitle, { market: marketLabel })}</p>
            <p className="mt-1 text-sm text-white/80">{d.common.collected} {f.date((bench.serpLeaders?.generatedAt ?? bench.generatedAt).slice(0, 10))}</p>
          </div>
        </div>
      </Reveal>

      {trackedTotal > 0 && (
        <Reveal>
          <div className="card flex items-start gap-3 border-l-4 border-l-brand">
            <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
            <p className="text-sm font-medium text-ink/80">{t(trackedHits === 0 ? b.trackedNone : b.trackedSome, { n: f.int(trackedTotal) })}</p>
          </div>
        </Reveal>
      )}

      <section className="space-y-3">
        {domains.length > CARDS && <ChipFilter options={domains.map((x) => ({ value: x.domain, label: x.domain }))} selected={cards} onChange={setCards}
          defaults={defaultCards} labels={{ top: t(d.common.topN, { n: CARDS }), all: d.common.showAll }} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {domains.filter((x) => cards.includes(x.domain)).map((x, i) => (
            <Reveal key={x.domain} delay={i * 0.05} className="h-full">
              <div onClick={() => { setSelected(x.domain); setLimit(PAGE); }}
                className={`card card-hover h-full w-full cursor-pointer text-left ${x.domain === selected ? "ring-2 ring-brand/40" : ""}`}>
                <button type="button" aria-pressed={x.domain === selected} className="flex items-center gap-2" onClick={(e) => { e.stopPropagation(); setSelected(x.domain); setLimit(PAGE); }}>
                  <span className="h-3 w-3 rounded-full" style={{ background: color(x.domain) }} />
                  <span className="font-semibold">{x.domain}</span>
                </button>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div><div className="text-2xl font-semibold tabular-nums"><CountUp value={x.traffic} format={f.int} /></div><div className="text-[11px] text-ink/50">{b.traffic}<InfoTip text={b.help.traffic} align="left" /></div></div>
                  <div><div className="text-2xl font-semibold tabular-nums"><CountUp value={x.total} format={f.int} /></div><div className="text-[11px] text-ink/50">{b.keywords}<InfoTip text={b.help.keywords} /></div></div>
                  <div><div className="text-2xl font-semibold tabular-nums"><CountUp value={x.top10} format={f.int} /></div><div className="text-[11px] text-ink/50">{b.top10}<InfoTip text={b.help.top10} align="right" /></div></div>
                </div>
                {trackedTotal > 0 && <p className="mt-2 text-xs text-ink/50">{t(b.trackedLine, { n: f.int(tracked[x.domain] ?? 0), total: f.int(trackedTotal) })}<InfoTip text={t(b.help.tracked, { total: f.int(trackedTotal) })} align="right" /></p>}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="card-title">{b.trafficChart}<InfoTip text={b.help.trafficChart} align="left" /></h3>
            <div style={{ height: Math.max(240, domains.length * 44) }}>
              <ResponsiveContainer>
                <BarChart data={trafficData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececef" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => f.int(Number(v))} />
                  <YAxis type="category" dataKey="domain" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v) => f.int(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {RANGES.map((r, i) => <Bar key={r} dataKey={r} name={d.seo.bucket[r]} stackId="t" fill={BUCKET_COLORS[r]} animationDuration={900} radius={i === RANGES.length - 1 ? [0, 6, 6, 0] : 0} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title">{b.keywordsChart}<InfoTip text={b.help.keywordsChart} align="left" /></h3>
            <div style={{ height: Math.max(240, domains.length * 44) }}>
              <ResponsiveContainer>
                <BarChart data={kwData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ececef" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="domain" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP} formatter={(v) => f.int(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={b.keywords} fill="#1F1F22" radius={[0, 6, 6, 0]} animationDuration={900} />
                  <Bar dataKey={b.top10} fill="#EA3323" radius={[0, 6, 6, 0]} animationDuration={900} />
                  {trackedTotal > 0 && <Bar dataKey={b.tracked} fill="#F8B4AD" radius={[0, 6, 6, 0]} animationDuration={900} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="bench-list">
          <h2 id="bench-list" className="section-title">{t(b.list, { domain: current.domain })}</h2>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Segmented label={b.title} layoutId="bench-domain" value={current.domain} onChange={(v) => { setSelected(v); setLimit(PAGE); }}
              options={domains.map((x) => ({ value: x.domain, label: x.domain }))} />
            <input className="input min-w-56" type="search" placeholder={b.search} value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
            <Segmented label={b.scope.label} layoutId="bench-scope" value={scope} onChange={(v) => { setScope(v as typeof scope); setLimit(PAGE); }}
              options={[{ value: "all", label: b.scope.all }, { value: "tracked", label: b.scope.tracked }, { value: "other", label: b.scope.other }]} />
            <button type="button" className="btn ml-auto" onClick={exportCsv}>{d.common.exportCsv}</button>
          </div>
          <p className="mb-2 text-xs text-ink/50">{t(b.listNote, { shown: f.int(Math.min(limit, rows.length)), total: f.int(scope === "all" ? current.total : rows.length) })}</p>
          <div className="card max-h-[600px] overflow-auto p-0">
            <table className="tbl">
              <thead className="sticky top-0 z-10"><tr>
                <th scope="col">{b.col.keyword}</th><th scope="col" className="num">{b.col.position}</th><th scope="col" className="num">{b.col.volume}</th>
                <th scope="col" className="num">{b.col.traffic}<InfoTip text={b.help.traffic} align="right" /></th><th scope="col">{b.col.url}</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, limit).map((k) => (
                  <tr key={`${k.keyword}|${k.language ?? ""}|${k.url}`}>
                    <td>{k.keyword}{k.tracked && <span className="pill ml-2 text-[10px]">{b.scope.badge}</span>}{k.language && k.language !== bench.language && <span className="ml-2 text-[10px] uppercase text-ink/40">{k.language}</span>}</td>
                    <td className="num" style={{ background: POSITION_COLORS[positionTone(k.position)] }}>{k.position}</td>
                    <td className="num">{f.int(k.volume)}</td><td className="num">{f.dec1(k.traffic)}</td>
                    <td className="max-w-[28rem] truncate"><a className="text-ink/70 hover:text-brand hover:underline" href={k.url} target="_blank" rel="noopener noreferrer nofollow">{k.url.replace(/^https?:\/\/(www\.)?/, "")}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > limit && <button type="button" className="btn-ghost mt-3" onClick={() => setLimit((n) => n + PAGE)}>+ {f.int(Math.min(PAGE, rows.length - limit))}</button>}
        </section>
      </Reveal>

      {bench.serpLeaders && bench.serpLeaders.items.length > 0 && <SerpLeaders data={bench.serpLeaders} meta={keywordMeta} d={d} f={f} />}

      <footer className="border-t border-line pt-3 text-xs text-ink/50">{t(bench.allLanguages ? b.footerAll : b.footer, { source: bench.source, lang: bench.language, date: f.date(bench.generatedAt.slice(0, 10)) })}</footer>
    </div>
  );
}
