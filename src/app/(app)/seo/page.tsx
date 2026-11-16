import { requirePageUser } from "@/lib/auth/guard";
import { getDict } from "@/lib/i18n/server";
import { resolveMarket, param } from "@/lib/market";
import { getSeoView } from "@/lib/seo/service";
import { SeoDashboard } from "@/components/seo/seo-dashboard";
import { ComingSoon } from "@/components/coming-soon";

export default async function SeoPage({ searchParams }: PageProps<"/seo">) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const { d, lang } = await getDict();
  const { market } = await resolveMarket(user.projectId, sp.market);
  const { result, data, project } = await getSeoView(user.projectId, market, param(sp.category, "all"));
  const marketLabel = (d.markets as Record<string, string>)[market] ?? market;
  if (!result || !data) return <ComingSoon title={`${d.seo.title} · ${marketLabel}`} d={d} />;
  return <SeoDashboard result={result} meta={data.meta} brand={project.brandLabel} client={project.name} marketLabel={marketLabel} d={d} lang={lang} />;
}
