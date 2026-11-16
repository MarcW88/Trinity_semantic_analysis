import { requirePageUser } from "@/lib/auth/guard";
import { getDict } from "@/lib/i18n/server";
import { resolveMarket } from "@/lib/market";
import { getGeoView, parseGeoFilters } from "@/lib/geo/service";
import { ComingSoon } from "@/components/coming-soon";
import { GeoDashboard } from "@/components/geo/geo-dashboard";

export default async function GeoPage({ searchParams }: PageProps<"/geo">) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { d, lang } = await getDict();
  const { market } = await resolveMarket(user.projectId, sp.market);
  const filters = parseGeoFilters(sp);
  const view = await getGeoView(user.projectId, market, filters);
  const marketLabel = (d.markets as Record<string, string>)[market] ?? market;
  if (view.empty) return <ComingSoon title={`${d.geo.title} · ${marketLabel}`} d={d} />;
  return <GeoDashboard market={market} marketLabel={marketLabel} filters={filters} result={view.result} categories={view.categories} brand={view.project.brandLabel} client={view.project.name} d={d} lang={lang} />;
}
