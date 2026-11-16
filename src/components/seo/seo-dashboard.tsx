"use client";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SeoMarketMeta, SeoResult } from "@/lib/seo/types";
import { BUCKETS } from "@/lib/seo/types";
import { makeFormat, t, type Dict } from "@/lib/i18n";
import type { UiLang } from "@/lib/config";
import { BUCKET_COLORS } from "@/lib/config";
import { KpiCard } from "../kpi-card";
import { CountUp, Reveal, Segmented } from "../motion";
import { Explorer } from "./explorer";
import { DistributionChart, VisibilityChart, VisibilityByCategoryChart, Donut } from "./charts";

type Props = { result: SeoResult; meta: SeoMarketMeta; brand: string; client: string; marketLabel: string; d: Dict; lang: UiLang };

export function SeoDashboard({ result, meta, brand, client, marketLabel, d, lang }: Props) {
  const f = useMemo(() => makeFormat(lang), [lang]);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [rankMode, setRankMode] = useState<"ranked" | "top20" | "top10">("ranked");
  const k = result.kpis;
  const s = d.seo;
  const rankedValue = rankMode === "ranked" ? k.ranked : rankMode === "top20" ? k.top20 : k.top10;

  const setCategory = (c: string) => start(() => {
    const next = new URLSearchParams(params.toString());
    next.set("market", result.market);
    if (c === "all") next.delete("category"); else next.set("category", c);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  });

  const categoryOptions = [{ value: "all", label: d.common.all }, ...result.categories.map((c) => ({ value: c.categoryId, label: c.label }))];

  return (
    <div className={`space-y-10 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <Reveal>
        <div className="hero">
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">{client} · {marketLabel}</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{s.title}</h1>
              {meta.snapshotDate && <p className="mt-1 text-sm text-white/80">{d.common.collected} {f.date(meta.snapshotDate)}</p>}
            </div>
            <div className="flex gap-6 text-white">
              <div><div className="text-3xl font-semibold tabular-nums"><CountUp value={k.keywords} format={f.int} /></div><div className="text-xs text-white/70">{s.keywords}</div></div>
              <div><div className="text-3xl font-semibold tabular-nums"><CountUp value={k.volume} format={f.int} /></div><div className="text-xs text-white/70">{s.volume}</div></div>
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-ink/60">{d.common.category}</span>
          <Segmented label={d.common.category} layoutId="category-pill" value={result.category} options={categoryOptions} onChange={setCategory} disabled={pending} />
        </div>
      </Reveal>

      <section aria-labelledby="kpis">
        <h2 id="kpis" className="section-title">{s.kpis}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            <KpiCard key="v" label={s.volume} value={k.volume} format={f.int} help={s.volumeHelp} />,
            <KpiCard key="k" label={s.keywords} value={k.keywords} format={f.int} help={s.keywordsHelp} />,
            <KpiCard key="r" accent label={s.ranked} value={rankedValue} format={f.int} suffix={` / ${f.int(k.keywords)}`}>
              <div role="radiogroup" aria-label={s.ranked} className="mt-1 flex gap-1">
                {(["ranked", "top20", "top10"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={rankMode === m} onClick={() => setRankMode(m)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${rankMode === m ? "bg-brand text-white" : "bg-mist text-ink/70 hover:bg-line"}`}>
                    {m === "ranked" ? s.rankedAll : m === "top20" ? s.top20 : s.top10}
                  </button>
                ))}
              </div>
            </KpiCard>,
            <KpiCard key="a" label={s.avgPosition} value={k.avgPosition} format={f.dec1} help={s.avgHelp} />,
            <KpiCard key="ai" label={s.aiPresence} value={k.aiRate} format={f.pct} help={t(s.aiPresenceHelp, { n: f.int(k.aiCount) })} />,
            <KpiCard key="c" label={t(s.aiCitation, { brand })} value={k.citedRate} format={f.pct} help={t(s.aiCitationHelp, { n: f.int(k.aiCited), d: f.int(k.aiCount) })} />,
          ].map((card, i) => <Reveal key={i} delay={i * 0.06} className="h-full">{card}</Reveal>)}
        </div>
      </section>

      <Reveal>
      <section aria-labelledby="cat">
        <h2 id="cat" className="section-title">{s.categoryPerf}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="card-title">{s.distribution}</h3>
            <DistributionChart data={result.distribution} labels={s.bucket} />
            <ul className="mt-2 flex flex-wrap gap-3 text-xs">
              {BUCKETS.map((b) => (
                <li key={b} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: BUCKET_COLORS[b] }} />{s.bucket[b]}</li>
              ))}
            </ul>
          </div>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                <th scope="col">{s.catTable.category}</th><th scope="col" className="num">{s.catTable.volume}</th><th scope="col" className="num">{s.catTable.keywords}</th>
                <th scope="col" className="num">{s.catTable.top10}</th><th scope="col" className="num">{s.catTable.avg}</th><th scope="col" className="num">{s.catTable.unranked}</th>
              </tr></thead>
              <tbody>
                {result.categoryTable.map((c) => (
                  <tr key={c.categoryId}>
                    <td>{c.category}</td><td className="num">{f.int(c.volume)}</td><td className="num">{f.int(c.keywords)}</td>
                    <td className="num">{f.int(c.top10)}</td><td className="num">{f.dec1(c.avgPosition)}</td><td className="num">{f.int(c.unranked)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section aria-labelledby="comp">
        <h2 id="comp" className="section-title">{s.competition}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="card-title">{s.visibility}</h3>
            <VisibilityChart data={result.visibility} total={k.keywords} domains={result.domains} />
          </div>
          <div className="card">
            <h3 className="card-title">{s.visibilityByCat}</h3>
            <VisibilityByCategoryChart data={result.visibilityByCategory} domains={result.domains} />
          </div>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                <th scope="col">{s.visTable.domain}</th>
                <th scope="col" className="num">{s.visTable.ranked} / {f.int(k.keywords)}</th>
                <th scope="col" className="num">{s.visTable.top20} / {f.int(k.keywords)}</th>
                <th scope="col" className="num">{s.visTable.top10} / {f.int(k.keywords)}</th>
              </tr></thead>
              <tbody>
                {result.visibility.map((v) => (
                  <tr key={v.domain} className={v.label === brand ? "font-semibold" : ""}>
                    <td>{v.label}</td><td className="num">{f.int(v.ranked)}</td><td className="num">{f.int(v.top20)}</td><td className="num">{f.int(v.top10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card overflow-x-auto">
            <h3 className="card-title">{s.leaders}</h3>
            <table className="tbl">
              <thead><tr>
                <th scope="col">{s.leaderTable.category}</th><th scope="col">{s.leaderTable.leader}</th><th scope="col" className="num">{s.leaderTable.leaderRate}</th>
                <th scope="col" className="num">{t(s.leaderTable.clientRate, { brand })}</th><th scope="col" className="num">{s.leaderTable.gap}</th>
              </tr></thead>
              <tbody>
                {result.leaders.map((l) => (
                  <tr key={l.categoryId}>
                    <td>{l.category}</td><td>{l.leader ?? <span className="text-ink/50">{s.noLeader}</span>}</td>
                    <td className="num">{f.dec1(l.leaderRate)} %</td><td className="num">{f.dec1(l.clientRate)} %</td><td className="num">{f.dec1(l.gap)} pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section aria-labelledby="ai">
        <h2 id="ai" className="section-title">{s.ai}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card">
            <h3 className="card-title">{s.aiDonut}</h3>
            <Donut data={[{ name: s.withAi, value: k.aiCount, color: "#EA3323" }, { name: s.withoutAi, value: k.keywords - k.aiCount, color: "#E4E4E7" }]} format={f.int} />
          </div>
          <div className="card">
            <h3 className="card-title">{s.citeDonut}</h3>
            {k.aiCount > 0
              ? <Donut data={[{ name: t(s.cited, { brand }), value: k.aiCited, color: "#1F1F22" }, { name: s.notCited, value: k.aiCount - k.aiCited, color: "#F8B4AD" }]} format={f.int} />
              : <p className="py-12 text-center text-sm text-ink/50">{s.noAi}</p>}
          </div>
          <div className="card max-h-80 overflow-auto">
            <h3 className="card-title">{s.aiTable}</h3>
            {result.aiRows.length === 0 ? <p className="text-sm text-ink/50">{s.noAi}</p> : (
              <table className="tbl">
                <thead><tr><th scope="col">{s.col.keyword}</th><th scope="col" className="num">{s.col.volume}</th><th scope="col" className="num">{t(s.col.position, { brand })}</th><th scope="col">{t(s.cited, { brand })}</th></tr></thead>
                <tbody>
                  {result.aiRows.map((r) => (
                    <tr key={r.keywordId}><td>{r.keyword}</td><td className="num">{f.int(r.volume)}</td><td className="num">{r.clientPos ?? "—"}</td><td>{r.cited ? d.common.yes : d.common.no}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
      </Reveal>

      <Reveal>
      <Explorer result={result} brand={brand} d={d} lang={lang} />
      </Reveal>

      <footer className="border-t border-line pt-3 text-xs text-ink/50">
        {t(d.common.footer, { client, view: `SEO ${marketLabel}`, date: f.date(meta.snapshotDate) })} · {t(d.common.sources, { files: meta.source })}
      </footer>
    </div>
  );
}
