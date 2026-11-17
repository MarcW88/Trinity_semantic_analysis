export type BenchmarkKeyword = { keyword: string; position: number; url: string; volume: number; traffic: number; cpc: number | null; language?: string; tracked?: boolean };
export type BenchmarkDomain = {
  domain: string; total: number; top3: number; top10: number; top20: number; traffic: number;
  trafficByRange: { top3: number; "4-10": number; "11-20": number; "21+": number };
  keywords: BenchmarkKeyword[];
};
export type Benchmark = { market: string; generatedAt: string; source: string; location: number; language: string; allLanguages?: boolean; domains: BenchmarkDomain[]; serpLeaders?: SerpLeaders };
export type SerpLeader = { domain: string; keywords: number; top3: number; top10: number; traffic: number; avgPosition: number; positions: { keyword: string; position: number }[] };
export type SerpLeaders = { generatedAt: string; trackedKeywords: number; keywordsWithSerp?: number; source?: string; items: SerpLeader[]; serp?: Record<string, { domain: string; position: number; url: string }[]>; serpDepth?: number };

const CTR = [0.316, 0.143, 0.089, 0.067, 0.054, 0.045, 0.038, 0.033, 0.029, 0.026];
export const ctr = (p: number) => (p <= 10 ? CTR[p - 1] : p <= 20 ? 0.01 : 0);
/** Tracked-keyword leaders and per-keyword top 20, built from the workbook's `serp` worksheet. */
export function serpLeadersFromRows(rows: { keyword: string; position: number; domain: string; url: string }[], volumes: Record<string, number>, generatedAt: string): SerpLeaders | null {
  const serp: NonNullable<SerpLeaders["serp"]> = {};
  const byDomain = new Map<string, { traffic: number; positions: { keyword: string; position: number }[] }>();
  for (const r of rows) {
    if (r.position > 20 || !(r.keyword in volumes)) continue;
    const sites = (serp[r.keyword] ??= []);
    if (sites.some((s) => s.domain === r.domain)) continue;
    sites.push({ domain: r.domain, position: r.position, url: r.url });
    const d = byDomain.get(r.domain) ?? { traffic: 0, positions: [] };
    d.traffic += volumes[r.keyword] * ctr(r.position);
    d.positions.push({ keyword: r.keyword, position: r.position });
    byDomain.set(r.domain, d);
  }
  if (byDomain.size === 0) return null;
  for (const sites of Object.values(serp)) sites.sort((a, b) => a.position - b.position);
  const items = [...byDomain].map(([domain, d]) => {
    const ps = d.positions.sort((a, b) => a.position - b.position);
    return {
      domain, keywords: ps.length, top3: ps.filter((p) => p.position <= 3).length, top10: ps.filter((p) => p.position <= 10).length,
      traffic: Math.round(d.traffic), avgPosition: Math.round((ps.reduce((s, p) => s + p.position, 0) / ps.length) * 10) / 10, positions: ps,
    };
  }).sort((a, b) => b.top10 - a.top10 || b.traffic - a.traffic).slice(0, 30);
  return { generatedAt, trackedKeywords: Object.keys(volumes).length, keywordsWithSerp: Object.keys(serp).length, source: "Excel serp (top 20)", items, serp, serpDepth: 20 };
}

const sameSite = (serpDomain: string, domain: string) => serpDomain === domain || serpDomain.endsWith(`.${domain}`);

// Labs keywords of each competitor, with tracked keywords overridden by the live Google SERP snapshot (real positions).
export function withTrackedSerp(bench: Benchmark, volumes: Record<string, number>): BenchmarkDomain[] {
  const serp = bench.serpLeaders?.serp;
  const isTracked = (k: BenchmarkKeyword) => (!k.language || k.language === bench.language) && k.keyword.toLowerCase() in volumes;
  if (!serp) return bench.domains.map((dm) => ({ ...dm, keywords: dm.keywords.map((k) => ({ ...k, tracked: isTracked(k) })) }));
  const leaderPositions = new Map(bench.serpLeaders!.items.map((l) => [l.domain, l.positions]));
  return bench.domains.map((dm) => {
    const key = (kw: string, lang?: string) => `${kw.toLowerCase()}|${lang || bench.language}`;
    const byKw = new Map(dm.keywords.map((k) => [key(k.keyword, k.language), { ...k, tracked: isTracked(k) }]));
    const hits = new Map<string, { position: number; url: string }>();
    for (const [kw, sites] of Object.entries(serp)) {
      const s = sites.find((x) => sameSite(x.domain, dm.domain));
      if (s && kw in volumes) hits.set(kw, { position: s.position, url: s.url });
    }
    for (const p of leaderPositions.get(dm.domain) ?? []) if (!hits.has(p.keyword) && p.keyword in volumes) hits.set(p.keyword, { position: p.position, url: "" });
    // The SERP snapshot is authoritative for tracked keywords down to its depth (the saved JSON map stops at 10): drop Labs positions it does not confirm.
    const depth = bench.serpLeaders!.serpDepth ?? 10;
    for (const [k, v] of byKw) if (v.tracked && v.position <= depth && !hits.has(v.keyword.toLowerCase())) byKw.delete(k);
    for (const [kw, h] of hits) {
      const old = byKw.get(key(kw));
      const volume = volumes[kw] ?? old?.volume ?? 0;
      byKw.set(key(kw), { keyword: kw, position: h.position, url: h.url || old?.url || "", volume, traffic: Math.round(volume * ctr(h.position) * 10) / 10, cpc: old?.cpc ?? null, language: old?.language, tracked: true });
    }
    const all = [...byKw.values()].sort((a, b) => b.traffic - a.traffic || b.volume - a.volume || a.position - b.position);
    const band = (ks: BenchmarkKeyword[], lo: number, hi: number) => ks.filter((k) => k.position >= lo && k.position <= hi);
    const sum = (ks: BenchmarkKeyword[]) => ks.reduce((s, k) => s + k.traffic, 0);
    // Saved aggregates also cover keywords cut from the capped list: keep that remainder and swap the listed ones.
    const delta = (lo: number, hi: number) => band(all, lo, hi).length - band(dm.keywords, lo, hi).length;
    const tr = (lo: number, hi: number, saved: number) => Math.round(saved + sum(band(all, lo, hi)) - sum(band(dm.keywords, lo, hi)));
    return {
      domain: dm.domain, total: dm.total + all.length - dm.keywords.length,
      top3: dm.top3 + delta(1, 3), top10: dm.top10 + delta(1, 10), top20: dm.top20 + delta(1, 20),
      traffic: tr(1, 1e9, dm.traffic),
      trafficByRange: { top3: tr(1, 3, dm.trafficByRange.top3), "4-10": tr(4, 10, dm.trafficByRange["4-10"]), "11-20": tr(11, 20, dm.trafficByRange["11-20"]), "21+": tr(21, 1e9, dm.trafficByRange["21+"]) },
      keywords: all,
    };
  });
}
