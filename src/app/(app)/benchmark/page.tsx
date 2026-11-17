import { requirePage } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { resolveMarket } from "@/lib/market";
import { getBenchmark, getMarketData } from "@/lib/seo/source";
import { withTrackedSerp } from "@/lib/seo/benchmark";
import { BenchmarkView } from "@/components/benchmark/benchmark-view";
import { ComingSoon } from "@/components/coming-soon";

export default async function BenchmarkPage({ searchParams }: PageProps<"/benchmark">) {
  await requirePage();
  const sp = await searchParams;
  const { d, lang } = await getDict();
  const market = await resolveMarket(sp.market);
  const marketLabel = (d.markets as Record<string, string>)[market] ?? market;
  const [bench, data] = await Promise.all([getBenchmark(market), getMarketData(market)]);
  if (!bench || bench.domains.length === 0) return <ComingSoon title={`${d.bench.title} · ${marketLabel}`} market={market} d={{ ...d, common: { ...d.common, comingSoonText: d.bench.none } }} />;
  const included = new Set(data?.categories.filter((c) => c.include).map((c) => c.categoryId));
  const trackedIds = new Set(data?.keywords.filter((k) => included.has(k.categoryId)).map((k) => k.keywordId));
  const trackedTotal = trackedIds.size;
  const catLabel = new Map(data?.categories.map((c) => [c.categoryId, c.label]));
  const keywordMeta = Object.fromEntries((data?.keywords ?? []).filter((k) => included.has(k.categoryId))
    .map((k) => [k.keyword.trim().toLowerCase(), { category: catLabel.get(k.categoryId) ?? "", volume: k.volume }]));
  const domains = withTrackedSerp(bench, Object.fromEntries(Object.entries(keywordMeta).map(([k, m]) => [k, m.volume])));
  const tracked = Object.fromEntries(domains.map((b) => [b.domain, bench.serpLeaders?.serp
    ? b.keywords.filter((k) => k.tracked && k.position <= 20).length
    : data?.rankings.filter((r) => r.domain === b.domain && trackedIds.has(r.keywordId)).length ?? 0]));
  return <BenchmarkView bench={{ ...bench, domains }} tracked={tracked} trackedTotal={trackedTotal} keywordMeta={keywordMeta} marketLabel={marketLabel} d={d} lang={lang} />;
}
