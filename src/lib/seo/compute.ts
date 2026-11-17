import type { AiFilter, Bucket, DomainInfo, ExplorerRow, MarketData, PosFilter, SeoKeyword, SeoResult } from "./types";
import { BUCKETS } from "./types";
import { CLIENT_COLOR, COMPETITOR_COLORS } from "../config";

export const CLIENT_KEY = "__client__";
export const ALL = "all";
const UNRANKED_POSITION = 100;

export function bucketOf(pos: number | null): Bucket {
  if (pos === null) return "unranked";
  if (pos <= 3) return "top3";
  if (pos <= 10) return "4-10";
  if (pos <= 20) return "11-20";
  return "21+";
}

export function positionTone(pos: number | null): "top3" | "top10" | "top20" | "top50" | "low" | "none" {
  if (pos === null) return "none";
  if (pos <= 3) return "top3";
  if (pos <= 10) return "top10";
  if (pos <= 20) return "top20";
  if (pos <= 50) return "top50";
  return "low";
}

const rate = (n: number, d: number) => (d > 0 ? n / d : null);

function avgPos(rows: SeoKeyword[]): number | null {
  if (rows.length === 0) return null;
  return rows.reduce((s, k) => s + (k.clientPos ?? UNRANKED_POSITION), 0) / rows.length;
}

/** Domains for a scope, ordered by sort_order; falls back to the default scope. */
export function scopeDomains(data: MarketData, scope: string): string[] {
  const own = data.scopes.filter((s) => s.scope === scope);
  const list = own.length > 0 ? own : data.scopes.filter((s) => s.scope === "default");
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.domain);
}

export function includedCategories(data: MarketData) {
  return [...data.categories].filter((c) => c.include).sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Active competitor domains: default then category-specific lists (deduplicated) for "all". */
export function activeDomains(data: MarketData, category: string): string[] {
  if (category !== ALL) return scopeDomains(data, category);
  const out: string[] = [];
  const push = (d: string) => { if (!out.includes(d)) out.push(d); };
  scopeDomains(data, "default").forEach(push);
  for (const c of includedCategories(data)) {
    if (data.scopes.some((s) => s.scope === c.categoryId)) scopeDomains(data, c.categoryId).forEach(push);
  }
  return out;
}

export function filterExplorer(rows: ExplorerRow[], pos: PosFilter, ai: AiFilter): ExplorerRow[] {
  return rows.filter((r) => {
    if (pos !== "all" && r.bucket !== pos) return false;
    if (ai === "with_ai" && !r.hasAiOverview) return false;
    if (ai === "cited" && !r.clientInAi) return false;
    if (ai === "opportunity" && !(r.hasAiOverview && !r.clientInAi)) return false;
    return true;
  });
}

export function computeSeo(data: MarketData, requestedCategory: string, brandLabel: string): SeoResult {
  const cats = includedCategories(data);
  const catById = new Map(cats.map((c) => [c.categoryId, c]));
  const category = requestedCategory !== ALL && catById.has(requestedCategory) ? requestedCategory : ALL;

  const keywords = data.keywords
    .filter((k) => catById.has(k.categoryId) && (category === ALL || k.categoryId === category))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const N = keywords.length;

  const positions = new Map<string, Map<string, number>>();
  for (const r of data.rankings) {
    let m = positions.get(r.keywordId);
    if (!m) positions.set(r.keywordId, (m = new Map()));
    m.set(r.domain, r.position);
  }
  const posOf = (k: SeoKeyword, domain: string): number | null =>
    domain === CLIENT_KEY ? k.clientPos : positions.get(k.keywordId)?.get(domain) ?? null;

  const compByDomain = new Map(data.competitors.map((c) => [c.domain, c]));
  const domainList = activeDomains(data, category);
  const domains: DomainInfo[] = [
    { domain: CLIENT_KEY, label: brandLabel, color: CLIENT_COLOR, isClient: true },
    ...domainList.map((d, i) => ({
      domain: d,
      label: compByDomain.get(d)?.label ?? d,
      color: compByDomain.get(d)?.colorHex ?? COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
      isClient: false,
    })),
  ];
  const labelOf = (d: string) => domains.find((x) => x.domain === d)?.label ?? compByDomain.get(d)?.label ?? d;

  const ranked = keywords.filter((k) => k.clientPos !== null).length;
  const top20 = keywords.filter((k) => k.clientPos !== null && k.clientPos <= 20).length;
  const top10 = keywords.filter((k) => k.clientPos !== null && k.clientPos <= 10).length;
  const aiCount = keywords.filter((k) => k.hasAiOverview).length;
  const aiCited = keywords.filter((k) => k.hasAiOverview && k.clientInAi).length;

  const presentCats = cats.filter((c) => keywords.some((k) => k.categoryId === c.categoryId));
  const byCat = new Map(presentCats.map((c) => [c.categoryId, keywords.filter((k) => k.categoryId === c.categoryId)]));

  const distribution = presentCats.map((c) => {
    const counts = Object.fromEntries(BUCKETS.map((b) => [b, 0])) as Record<Bucket, number>;
    for (const k of byCat.get(c.categoryId)!) counts[bucketOf(k.clientPos)]++;
    return { categoryId: c.categoryId, category: c.label, counts };
  });

  const categoryTable = presentCats.map((c) => {
    const rows = byCat.get(c.categoryId)!;
    return {
      categoryId: c.categoryId, category: c.label,
      volume: rows.reduce((s, k) => s + k.volume, 0), keywords: rows.length,
      top10: rows.filter((k) => k.clientPos !== null && k.clientPos <= 10).length,
      avgPosition: avgPos(rows), unranked: rows.filter((k) => k.clientPos === null).length,
    };
  }).sort((a, b) => b.volume - a.volume);

  const visibility = domains.map((d) => {
    let r = 0, t20 = 0, t10 = 0;
    for (const k of keywords) {
      const p = posOf(k, d.domain);
      if (p === null) continue;
      r++; if (p <= 20) t20++; if (p <= 10) t10++;
    }
    return { domain: d.domain, label: d.label, ranked: r, top20: t20, top10: t10, rankedRate: rate(r, N), top20Rate: rate(t20, N), top10Rate: rate(t10, N) };
  }).sort((a, b) => b.ranked - a.ranked);

  const eligible = (categoryId: string) => [CLIENT_KEY, ...scopeDomains(data, categoryId)];
  const top10Count = (rows: SeoKeyword[], d: string) => rows.filter((k) => { const p = posOf(k, d); return p !== null && p <= 10; }).length;

  const visibilityByCategory = presentCats.map((c) => {
    const rows = byCat.get(c.categoryId)!;
    return {
      categoryId: c.categoryId, category: c.label,
      rates: eligible(c.categoryId).map((d) => {
        const n = top10Count(rows, d);
        return { domain: d, label: labelOf(d), top10: n, rate: rate(n, rows.length) };
      }),
    };
  });

  const leaders = presentCats.map((c, idx) => {
    const rows = byCat.get(c.categoryId)!;
    const total = rows.length;
    const scores = eligible(c.categoryId).map((d) => ({ d, n: top10Count(rows, d) }));
    const max = Math.max(...scores.map((s) => s.n));
    const clientRate = total > 0 ? (scores[0].n / total) * 100 : 0;
    if (max <= 0) return { idx, categoryId: c.categoryId, category: c.label, leader: null, leaderRate: 0, clientRate, gap: 0 };
    const lead = scores.find((s) => s.n === max)!;
    const leaderRate = total > 0 ? (lead.n / total) * 100 : 0;
    return { idx, categoryId: c.categoryId, category: c.label, leader: labelOf(lead.d), leaderRate, clientRate, gap: lead.d === CLIENT_KEY ? 0 : leaderRate - clientRate };
  }).sort((a, b) => b.gap - a.gap || a.idx - b.idx).map(({ idx: _idx, ...rest }) => rest);

  const byVolume = [...keywords].sort((a, b) => b.volume - a.volume || a.sortOrder - b.sortOrder);
  const aiRows = byVolume.filter((k) => k.hasAiOverview).map((k) => ({
    keywordId: k.keywordId, keyword: k.keyword, volume: k.volume, category: catById.get(k.categoryId)!.label, clientPos: k.clientPos, cited: k.clientInAi,
  }));

  const explorer: ExplorerRow[] = byVolume.map((k) => ({
    keywordId: k.keywordId, keyword: k.keyword, volume: k.volume, categoryId: k.categoryId,
    category: catById.get(k.categoryId)!.label, clientPos: k.clientPos,
    positions: Object.fromEntries(domainList.map((d) => [d, posOf(k, d)])),
    hasAiOverview: k.hasAiOverview, clientInAi: k.clientInAi, bucket: bucketOf(k.clientPos),
  }));

  return {
    market: data.meta.market, category,
    categories: cats.map((c) => ({ categoryId: c.categoryId, label: c.label })),
    domains,
    kpis: { volume: keywords.reduce((s, k) => s + k.volume, 0), keywords: N, ranked, top20, top10, avgPosition: avgPos(keywords), aiCount, aiCited, aiRate: rate(aiCount, N), citedRate: rate(aiCited, aiCount) },
    distribution, categoryTable, visibility, visibilityByCategory, leaders, aiRows, explorer,
  };
}
