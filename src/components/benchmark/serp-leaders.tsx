"use client";
import { useMemo, useState } from "react";
import type { SerpLeaders as Data } from "@/lib/seo/benchmark";
import { t, type Dict } from "@/lib/i18n";
import { POSITION_COLORS } from "@/lib/config";
import { positionTone } from "@/lib/seo/compute";
import { Pager, Reveal, Segmented } from "../motion";
import { InfoTip } from "../info-tip";

export type KeywordMeta = Record<string, { category: string; volume: number }>;
type Fmt = { int: (n: number) => string; dec1: (n: number) => string };

const Pos = ({ p }: { p: number }) => (
  <span className="inline-block min-w-7 rounded px-1 text-center text-xs font-semibold tabular-nums" style={{ background: POSITION_COLORS[positionTone(p)] }}>{p}</span>
);

export function SerpLeaders({ data, meta, d, f }: { data: Data; meta: KeywordMeta; d: Dict; f: Fmt }) {
  const b = d.bench;
  const [view, setView] = useState<"sites" | "keywords">("sites");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const per = view === "sites" ? 10 : 25;
  const leaders = useMemo(() => data.items.map((l) => {
    const top10 = l.positions.filter((p) => p.position <= 10);
    const cats = new Map<string, number>();
    for (const p of top10) { const c = meta[p.keyword]?.category; if (c) cats.set(c, (cats.get(c) ?? 0) + 1); }
    return { ...l, top10List: top10, cats: [...cats].sort((x, y) => y[1] - x[1]) };
  }), [data.items, meta]);
  const keywords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(data.serp ?? {})
      .map(([keyword, sites]) => ({ keyword, sites, category: meta[keyword]?.category ?? "", volume: meta[keyword]?.volume ?? 0 }))
      .filter((k) => k.sites.length > 0 && (!q || k.keyword.includes(q) || k.category.toLowerCase().includes(q) || k.sites.some((s) => s.domain.includes(q))))
      .sort((x, y) => y.volume - x.volume);
  }, [data.serp, meta, query]);

  return (
    <Reveal>
      <section aria-labelledby="serp-leaders" className="space-y-4">
        <div>
          <h2 id="serp-leaders" className="section-title">{b.leaders}</h2>
          <p className="-mt-2 text-sm text-ink/60">{t(b.leadersNote, { n: f.int(data.keywordsWithSerp ?? data.trackedKeywords) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data.serp && <Segmented label={b.leaders} layoutId="serp-view" value={view} onChange={(v) => { setView(v as "sites" | "keywords"); setPage(1); }}
            options={[{ value: "sites", label: b.viewSites }, { value: "keywords", label: b.viewKeywords }]} />}
          {view === "keywords" && <input className="input min-w-56" type="search" placeholder={b.search} value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />}
        </div>
        {view === "sites" ? (
          <div className="card overflow-auto p-0">
            <table className="tbl">
              <thead><tr>
                <th scope="col" className="num">#</th><th scope="col">{b.lcol.domain}</th><th scope="col" className="num">{b.lcol.top10}<InfoTip text={b.help.leadersTop10} /></th>
                <th scope="col" className="num">{b.lcol.top3}<InfoTip text={b.help.leadersTop3} /></th><th scope="col" className="num">{b.lcol.traffic}<InfoTip text={b.help.leadersTraffic} align="right" /></th><th scope="col">{b.lcol.cats}<InfoTip text={b.help.leadersCats} align="right" /></th><th scope="col">{b.lcol.kws}</th>
              </tr></thead>
              <tbody>
                {leaders.slice((page - 1) * per, page * per).map((l, i) => (
                  <tr key={l.domain} className="align-top">
                    <td className="num text-ink/50">{(page - 1) * per + i + 1}</td>
                    <td className="font-medium">{l.domain}</td>
                    <td className="num font-semibold">{f.int(l.top10)}</td><td className="num">{f.int(l.top3)}</td><td className="num">{f.int(l.traffic)}</td>
                    <td><div className="flex max-w-xs flex-wrap gap-1">{l.cats.slice(0, 3).map(([c, n]) => <span key={c} className="pill text-[11px]">{c} · {n}</span>)}</div></td>
                    <td className="min-w-64">
                      <details>
                        <summary className="cursor-pointer text-xs text-ink/70 hover:text-brand">{t(b.showKeywords, { n: f.int(l.top10List.length) })}</summary>
                        <ul className="mt-2 space-y-1 text-xs">
                          {l.top10List.map((p) => <li key={p.keyword} className="flex items-center gap-2"><Pos p={p.position} /><span>{p.keyword}</span>{meta[p.keyword] && <span className="text-ink/40">· {meta[p.keyword].category}</span>}</li>)}
                        </ul>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card max-h-[640px] overflow-auto p-0">
            <table className="tbl">
              <thead className="sticky top-0 z-10"><tr>
                <th scope="col">{b.col.keyword}</th><th scope="col">{b.lcol.category}</th><th scope="col" className="num">{b.col.volume}</th><th scope="col">{b.lcol.top3sites}</th>
              </tr></thead>
              <tbody>
                {keywords.slice((page - 1) * per, page * per).map((k) => (
                  <tr key={k.keyword} className="align-top">
                    <td>{k.keyword}</td><td className="text-xs text-ink/60">{k.category}</td><td className="num">{f.int(k.volume)}</td>
                    <td><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{k.sites.filter((s) => s.position <= 3).map((s) => (
                      <a key={s.domain} href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 hover:text-brand"><Pos p={s.position} />{s.domain}</a>
                    ))}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} pages={Math.ceil((view === "sites" ? leaders.length : keywords.length) / per)} onChange={setPage} labels={d.common} />
      </section>
    </Reveal>
  );
}
