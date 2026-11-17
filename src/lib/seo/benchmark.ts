export type BenchmarkKeyword = { keyword: string; position: number; url: string; volume: number; traffic: number; cpc: number | null };
export type BenchmarkDomain = {
  domain: string; total: number; top3: number; top10: number; top20: number; traffic: number;
  trafficByRange: { top3: number; "4-10": number; "11-20": number; "21+": number };
  keywords: BenchmarkKeyword[];
};
export type Benchmark = { market: string; generatedAt: string; source: string; location: number; language: string; domains: BenchmarkDomain[] };
