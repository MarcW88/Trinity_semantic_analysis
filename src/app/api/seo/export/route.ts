import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { resolveMarket } from "@/lib/market";
import { getSeoView } from "@/lib/seo/service";
import { filterExplorer } from "@/lib/seo/compute";
import { AI_FILTERS, POS_FILTERS, type AiFilter, type PosFilter } from "@/lib/seo/types";
import { csvResponse, toCsv } from "@/lib/csv";
import { DICTS, resolveLang, t } from "@/lib/i18n";
import { jsonPrivate } from "@/lib/auth/guard";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const sp = req.nextUrl.searchParams;
  const { market } = await resolveMarket(user.projectId, sp.get("market") ?? undefined);
  const pos = (POS_FILTERS as string[]).includes(sp.get("pos") ?? "") ? (sp.get("pos") as PosFilter) : "all";
  const ai = (AI_FILTERS as string[]).includes(sp.get("ai") ?? "") ? (sp.get("ai") as AiFilter) : "all";
  const { result, data, project } = await getSeoView(user.projectId, market, sp.get("category") ?? "all");
  if (!result || !data) return jsonPrivate({ error: "no_data" }, { status: 404 });
  const d = DICTS[resolveLang(req.cookies.get("ui_lang")?.value)];
  const rows = filterExplorer(result.explorer, pos, ai);
  const comps = result.domains.filter((x) => !x.isClient);
  const headers = [d.seo.col.keyword, d.seo.col.volume, d.seo.col.category, t(d.seo.col.position, { brand: project.brandLabel }), ...comps.map((c) => c.label), "has_ai_overview", "client_in_ai"];
  const body = toCsv(headers, rows.map((r) => [r.keyword, r.volume, r.category, r.clientPos, ...comps.map((c) => r.positions[c.domain]), r.hasAiOverview, r.clientInAi]));
  return csvResponse(body, `seo_${market}_${result.category}_${data.meta.snapshotDate}.csv`);
}
