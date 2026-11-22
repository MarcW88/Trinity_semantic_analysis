"use client";
import { useMemo, useState } from "react";
import { filterExplorer, positionTone } from "@/lib/seo/compute";
import { AI_FILTERS, POS_FILTERS, type AiFilter, type ExplorerRow, type PosFilter, type SeoResult } from "@/lib/seo/types";
import { POSITION_COLORS, type UiLang } from "@/lib/config";
import { makeFormat, t, type Dict } from "@/lib/i18n";

type SortKey = "keyword" | "volume" | "category" | "client" | string;

/** Numeric sort with missing values always last, regardless of direction. */
function compare(a: ExplorerRow, b: ExplorerRow, key: SortKey, dir: 1 | -1): number {
  const val = (r: ExplorerRow): string | number | null =>
    key === "keyword" ? r.keyword : key === "category" ? r.category : key === "volume" ? r.volume : key === "client" ? r.clientPos : r.positions[key] ?? null;
  const va = val(a), vb = val(b);
  if (va === null && vb === null) return b.volume - a.volume;
  if (va === null) return 1;
  if (vb === null) return -1;
  const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
  return c * dir || b.volume - a.volume;
}

export function Explorer({ result: directResult, seoResult, brand, d, lang }: { result: SeoResult; seoResult?: SeoResult; brand: string; d: Dict; lang: UiLang }) {
  const [comparison, setComparison] = useState<"direct" | "seo">("direct");
  const activeComparison = seoResult ? comparison : "direct";
  const result = activeComparison === "seo" && seoResult ? seoResult : directResult;
  const s = d.seo;
  const f = useMemo(() => makeFormat(lang), [lang]);
  const [pos, setPos] = useState<PosFilter>("all");
  const [ai, setAi] = useState<AiFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "volume", dir: -1 });
  const comps = result.domains.filter((x) => !x.isClient);
  const rows = useMemo(() => [...filterExplorer(result.explorer, pos, ai)].sort((a, b) => compare(a, b, sort.key, sort.dir)), [result.explorer, pos, ai, sort]);
  const exportHref = `/api/seo/export?${new URLSearchParams({ market: result.market, category: result.category, pos, ai, comparison: activeComparison }).toString()}`;

  const header = (key: SortKey, label: string, numeric = false) => {
    const active = sort.key === key;
    return (
      <th key={key} scope="col" className={numeric ? "num" : ""} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" className="inline-flex items-center gap-1 hover:underline" title={t(s.sortBy, { col: label })}
          onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : numeric && key !== "volume" ? 1 : key === "volume" ? -1 : 1 })}>
          {label}{active ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
        </button>
      </th>
    );
  };
  const posCell = (p: number | null, key: string) => (
    <td key={key} className="num" style={{ background: POSITION_COLORS[positionTone(p)] }}>{p ?? "—"}</td>
  );

  return (
    <section aria-labelledby="explorer">
      <h2 id="explorer" className="section-title">{s.explorer}</h2>
      {seoResult && (
        <div role="tablist" aria-label={s.explorer} className="mb-4 flex flex-wrap gap-2">
          {(["direct", "seo"] as const).map((mode) => (
            <button key={mode} id={`explorer-tab-${mode}`} type="button" role="tab" aria-selected={comparison === mode} aria-controls="explorer-panel"
              tabIndex={comparison === mode ? 0 : -1}
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
                e.preventDefault();
                const next = e.key === "Home" ? "direct" : e.key === "End" ? "seo" : comparison === "direct" ? "seo" : "direct";
                setComparison(next);
                setSort({ key: "volume", dir: -1 });
                document.getElementById(`explorer-tab-${next}`)?.focus();
              }}
              onClick={() => { setComparison(mode); setSort({ key: "volume", dir: -1 }); }}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${comparison === mode ? "bg-brand text-white" : "bg-mist text-ink/70 hover:bg-line"}`}>
              {mode === "direct" ? s.directCompetitors : s.seoCompetitors}
            </button>
          ))}
        </div>
      )}
      <div id="explorer-panel" role={seoResult ? "tabpanel" : undefined} aria-labelledby={seoResult ? `explorer-tab-${comparison}` : undefined}>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">{s.posFilter}
          <select className="select ml-2" value={pos} onChange={(e) => setPos(e.target.value as PosFilter)}>
            {POS_FILTERS.map((p) => <option key={p} value={p}>{s.pos[p]}</option>)}
          </select>
        </label>
        <label className="text-sm">{s.aiFilter}
          <select className="select ml-2" value={ai} onChange={(e) => setAi(e.target.value as AiFilter)}>
            {AI_FILTERS.map((a) => <option key={a} value={a}>{t(s.aiF[a], { brand })}</option>)}
          </select>
        </label>
        <span className="text-sm text-ink/60" aria-live="polite">{t(s.showing, { n: f.int(rows.length) })}</span>
        <a className="btn ml-auto" href={exportHref} download>{d.common.exportCsv}</a>
      </div>
      <div className="card max-h-[600px] overflow-auto p-0">
        <table className="tbl">
          <thead className="sticky top-0 z-10">
            <tr>
              {header("keyword", s.col.keyword)}
              {header("volume", s.col.volume, true)}
              {header("category", s.col.category)}
              {header("client", t(s.col.position, { brand }), true)}
              {comps.map((c) => header(c.domain, c.label, true))}
              <th scope="col">{s.col.ai}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.keywordId}>
                <td>{r.keyword}</td>
                <td className="num">{f.int(r.volume)}</td>
                <td>{r.category}</td>
                {posCell(r.clientPos, "client")}
                {comps.map((c) => posCell(r.positions[c.domain] ?? null, c.domain))}
                <td>{r.hasAiOverview ? <span title={r.clientInAi ? s.aiCited : s.aiYes}>{r.clientInAi ? "AI ✓" : "AI"}</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink/60">{s.legend}</p>
      </div>
    </section>
  );
}
