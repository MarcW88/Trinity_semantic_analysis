import { requirePage } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { resolveMarket } from "@/lib/market";
import { getBenchmark, getMarketData } from "@/lib/seo/source";
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
  const trackedTotal = data?.keywords.length ?? 0;
  const tracked = Object.fromEntries(bench.domains.map((b) => [b.domain, data?.rankings.filter((r) => r.domain === b.domain).length ?? 0]));
  return <BenchmarkView bench={bench} tracked={tracked} trackedTotal={trackedTotal} marketLabel={marketLabel} d={d} lang={lang} />;
}
