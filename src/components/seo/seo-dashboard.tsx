"use client";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SeoMarketMeta, SeoResult } from "@/lib/seo/types";
import { BUCKETS } from "@/lib/seo/types";
import { makeFormat, t, type Dict } from "@/lib/i18n";
import type { UiLang } from "@/lib/config";
import { BUCKET_COLORS } from "@/lib/config";
import { KpiCard } from "../kpi-card";
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

  return (
    <div className={`space-y-8 ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{s.title}</h1>
          <p className="text-sm text-gray-600">{marketLabel} · {d.common.collected} {f.date(meta.snapshotDate)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          {d.common.category}
          <select className="select" value={result.category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">{d.common.all}</option>
            {result.categories.map((c) => <option key={c.categoryId} value={c.categoryId}>{c.label}</option>)}
          </select>
        </label>
      </div>

      <section aria-labelledby="kpis">
        <h2 id="kpis" className="section-title">{s.kpis}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <KpiCard label={s.volume} value={f.int(k.volume)} help={s.volumeHelp} />
          <KpiCard label={s.keywords} value={f.int(k.keywords)} help={s.keywordsHelp} />
          <KpiCard label={s.ranked} value={`${f.int(rankedValue)} / ${f.int(k.keywords)}`}>
            <div role="radiogroup" aria-label={s.ranked} className="mt-1 flex gap-1">
              {(["ranked", "top20", "top10"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={rankMode === m} onClick={() => setRankMode(m)}
                  className={`rounded px-1.5 py-0.5 text-xs ${rankMode === m ? "bg-brown text-white" : "bg-cream text-ink"}`}>
                  {m === "ranked" ? s.rankedAll : m === "top20" ? s.top20 : s.top10}
                </button>
              ))}
            </div>
          </KpiCard>
          <KpiCard label={s.avgPosition} value={f.dec1(k.avgPosition)} help={s.avgHelp} />
          <KpiCard label={s.aiPresence} value={f.pct(k.aiRate)} help={t(s.aiPresenceHelp, { n: f.int(k.aiCount) })} />
          <KpiCard label={t(s.aiCitation, { brand })} value={f.pct(k.citedRate)} help={t(s.aiCitationHelp, { n: f.int(k.aiCited), d: f.int(k.aiCount) })} />
        </div>
      </section>

      <section aria-labelledby="cat">
        <h2 id="cat" className="section-title">{s.categoryPerf}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">{s.distribution}</h3>
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

      <section aria-labelledby="comp">
        <h2 id="comp" className="section-title">{s.competition}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">{s.visibility}</h3>
            <VisibilityChart data={result.visibility} total={k.keywords} domains={result.domains} />
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">{s.visibilityByCat}</h3>
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
            <h3 className="mb-2 text-sm font-semibold">{s.leaders}</h3>
            <table className="tbl">
              <thead><tr>
                <th scope="col">{s.leaderTable.category}</th><th scope="col">{s.leaderTable.leader}</th><th scope="col" className="num">{s.leaderTable.leaderRate}</th>
                <th scope="col" className="num">{t(s.leaderTable.clientRate, { brand })}</th><th scope="col" className="num">{s.leaderTable.gap}</th>
              </tr></thead>
              <tbody>
                {result.leaders.map((l) => (
                  <tr key={l.categoryId}>
                    <td>{l.category}</td><td>{l.leader ?? <span className="text-gray-500">{s.noLeader}</span>}</td>
                    <td className="num">{f.dec1(l.leaderRate)} %</td><td className="num">{f.dec1(l.clientRate)} %</td><td className="num">{f.dec1(l.gap)} pt</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="ai">
        <h2 id="ai" className="section-title">{s.ai}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">{s.aiDonut}</h3>
            <Donut data={[{ name: s.withAi, value: k.aiCount, color: "#8B7355" }, { name: s.withoutAi, value: k.keywords - k.aiCount, color: "#E5DDD4" }]} format={f.int} />
          </div>
          <div className="card">
            <h3 className="mb-2 text-sm font-semibold">{s.citeDonut}</h3>
            {k.aiCount > 0
              ? <Donut data={[{ name: t(s.cited, { brand }), value: k.aiCited, color: "#7A9E7E" }, { name: s.notCited, value: k.aiCount - k.aiCited, color: "#C9A59A" }]} format={f.int} />
              : <p className="py-12 text-center text-sm text-gray-500">{s.noAi}</p>}
          </div>
          <div className="card max-h-80 overflow-auto">
            <h3 className="mb-2 text-sm font-semibold">{s.aiTable}</h3>
            {result.aiRows.length === 0 ? <p className="text-sm text-gray-500">{s.noAi}</p> : (
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

      <Explorer result={result} brand={brand} d={d} lang={lang} />

      <footer className="border-t border-line pt-3 text-xs text-gray-500">
        {t(d.common.footer, { client, view: `SEO ${marketLabel}`, date: f.date(meta.snapshotDate) })} · {meta.source}
      </footer>
    </div>
  );
}
