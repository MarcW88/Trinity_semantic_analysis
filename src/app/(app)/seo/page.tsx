import { requirePage } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { resolveMarket, param } from "@/lib/market";
import { getMarketData } from "@/lib/seo/source";
import { computeSeo } from "@/lib/seo/compute";
import { CLIENT } from "@/lib/config";
import { SeoDashboard } from "@/components/seo/seo-dashboard";
import { ComingSoon } from "@/components/coming-soon";

export default async function SeoPage({ searchParams }: PageProps<"/seo">) {
  await requirePage();
  const sp = await searchParams;
  const { d, lang } = await getDict();
  const market = await resolveMarket(sp.market);
  const data = await getMarketData(market);
  const marketLabel = (d.markets as Record<string, string>)[market] ?? market;
  if (!data) return <ComingSoon title={`${d.seo.title} · ${marketLabel}`} market={market} d={d} />;
  const result = computeSeo(data, param(sp.category, "all"), CLIENT.brandLabel);
  return <SeoDashboard result={result} meta={data.meta} brand={CLIENT.brandLabel} client={CLIENT.name} marketLabel={marketLabel} d={d} lang={lang} />;
}
