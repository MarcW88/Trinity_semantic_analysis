export type SeoMarketMeta = {
  market: string; snapshotDate: string; source: string;
  notes: string | null; device: string | null; serpDepth: number | null; currency: string | null;
};
export type SeoCategory = { market: string; categoryId: string; label: string; include: boolean; sortOrder: number };
export type SeoKeyword = {
  market: string; keywordId: string; keyword: string; categoryId: string; volume: number;
  hasAiOverview: boolean; clientInAi: boolean; clientPos: number | null; clientUrl: string | null;
  clientAiSources: string[]; subcategory: string | null; priority: string | null; source: string | null;
  cpc: number | null; competition: string | null; paa: string | null; sortOrder: number;
};
export type SeoCompetitor = { market: string; domain: string; label: string; colorHex: string | null; sortOrder: number };
export type SeoScope = { market: string; scope: string; domain: string; sortOrder: number };
export type SeoRanking = { market: string; keywordId: string; domain: string; position: number };

export type SeoSnapshot = {
  meta: SeoMarketMeta[]; categories: SeoCategory[]; keywords: SeoKeyword[];
  competitors: SeoCompetitor[]; scopes: SeoScope[]; rankings: SeoRanking[];
};

export type MarketData = {
  meta: SeoMarketMeta; categories: SeoCategory[]; keywords: SeoKeyword[];
  competitors: SeoCompetitor[]; scopes: SeoScope[]; rankings: SeoRanking[];
};

export type Bucket = "top3" | "4-10" | "11-20" | "21+" | "unranked";
export const BUCKETS: Bucket[] = ["top3", "4-10", "11-20", "21+", "unranked"];
export type PosFilter = "all" | Bucket;
export type AiFilter = "all" | "with_ai" | "cited" | "opportunity";
export const POS_FILTERS: PosFilter[] = ["all", "top3", "4-10", "11-20", "21+", "unranked"];
export const AI_FILTERS: AiFilter[] = ["all", "with_ai", "cited", "opportunity"];

export type DomainInfo = { domain: string; label: string; color: string; isClient: boolean };

export type ExplorerRow = {
  keywordId: string; keyword: string; volume: number; categoryId: string; category: string;
  clientPos: number | null; positions: Record<string, number | null>; hasAiOverview: boolean; clientInAi: boolean;
  bucket: Bucket;
};

export type SeoResult = {
  market: string;
  category: string;
  categories: { categoryId: string; label: string }[];
  domains: DomainInfo[];
  kpis: {
    volume: number; keywords: number; ranked: number; top20: number; top10: number;
    avgPosition: number | null; aiCount: number; aiCited: number; aiRate: number | null; citedRate: number | null;
  };
  distribution: { categoryId: string; category: string; counts: Record<Bucket, number> }[];
  categoryTable: { categoryId: string; category: string; volume: number; keywords: number; top10: number; avgPosition: number | null; unranked: number }[];
  visibility: { domain: string; label: string; ranked: number; top20: number; top10: number; rankedRate: number | null; top20Rate: number | null; top10Rate: number | null }[];
  visibilityByCategory: { categoryId: string; category: string; rates: { domain: string; label: string; top10: number; rate: number | null }[] }[];
  leaders: { categoryId: string; category: string; leader: string | null; leaderRate: number; clientRate: number; gap: number }[];
  aiRows: { keywordId: string; keyword: string; volume: number; category: string; clientPos: number | null; cited: boolean }[];
  explorer: ExplorerRow[];
};
