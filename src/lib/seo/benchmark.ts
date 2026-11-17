export type BenchmarkKeyword = { keyword: string; position: number; url: string; volume: number; traffic: number; cpc: number | null; language?: string; tracked?: boolean };
export type BenchmarkDomain = {
  domain: string; total: number; top3: number; top10: number; top20: number; traffic: number;
  trafficByRange: { top3: number; "4-10": number; "11-20": number; "21+": number };
  keywords: BenchmarkKeyword[];
};
export type Benchmark = { market: string; generatedAt: string; source: string; location: number; language: string; allLanguages?: boolean; domains: BenchmarkDomain[]; serpLeaders?: SerpLeaders };
export type SerpLeader = { domain: string; keywords: number; top3: number; top10: number; traffic: number; avgPosition: number; positions: { keyword: string; position: number }[] };
export type SerpLeaders = { generatedAt: string; trackedKeywords: number; keywordsWithSerp?: number; source?: string; items: SerpLeader[]; serp?: Record<string, { domain: string; position: number; url: string }[]> };

const CTR = [0.316, 0.143, 0.089, 0.067, 0.054, 0.045, 0.038, 0.033, 0.029, 0.026];
export const ctr = (p: number) => (p <= 10 ? CTR[p - 1] : p <= 20 ? 0.01 : 0);
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
      if (s) hits.set(kw, { position: s.position, url: s.url });
    }
    for (const p of leaderPositions.get(dm.domain) ?? []) if (!hits.has(p.keyword)) hits.set(p.keyword, { position: p.position, url: "" });
    for (const [kw, h] of hits) {
      const old = byKw.get(key(kw));
      const volume = volumes[kw] ?? old?.volume ?? 0;
      byKw.set(key(kw), { keyword: kw, position: h.position, url: h.url || old?.url || "", volume, traffic: Math.round(volume * ctr(h.position) * 10) / 10, cpc: old?.cpc ?? null, language: old?.language, tracked: true });
    }
    const all = [...byKw.values()].sort((a, b) => b.traffic - a.traffic || b.volume - a.volume || a.position - b.position);
    const band = (lo: number, hi: number) => all.filter((k) => k.position >= lo && k.position <= hi);
    const sum = (ks: BenchmarkKeyword[]) => Math.round(ks.reduce((s, k) => s + k.traffic, 0));
    return {
      domain: dm.domain, total: Math.max(dm.total, 0) - dm.keywords.length + all.length, top3: band(1, 3).length, top10: band(1, 10).length, top20: band(1, 20).length,
      traffic: sum(all), trafficByRange: { top3: sum(band(1, 3)), "4-10": sum(band(4, 10)), "11-20": sum(band(11, 20)), "21+": sum(band(21, 1e9)) },
      keywords: all,
    };
  });
}
