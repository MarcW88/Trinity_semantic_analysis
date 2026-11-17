import type { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { resolveMarket } from "@/lib/market";
import { getMarketData } from "@/lib/seo/source";
import { computeSeo, filterExplorer } from "@/lib/seo/compute";
import { AI_FILTERS, POS_FILTERS, type AiFilter, type PosFilter } from "@/lib/seo/types";
import { csvResponse, toCsv } from "@/lib/csv";
import { DICTS, resolveLang, t } from "@/lib/i18n";
import { CLIENT } from "@/lib/config";

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const sp = req.nextUrl.searchParams;
  const market = await resolveMarket(sp.get("market"));
  const pos = (POS_FILTERS as string[]).includes(sp.get("pos") ?? "") ? (sp.get("pos") as PosFilter) : "all";
  const ai = (AI_FILTERS as string[]).includes(sp.get("ai") ?? "") ? (sp.get("ai") as AiFilter) : "all";
  const data = await getMarketData(market);
  if (!data) return json({ error: "no_data" }, 404);
  const result = computeSeo(data, sp.get("category") ?? "all", CLIENT.brandLabel);
  const d = DICTS[resolveLang(req.cookies.get("ui_lang")?.value)];
  const rows = filterExplorer(result.explorer, pos, ai);
  const comps = result.domains.filter((x) => !x.isClient);
  const headers = [d.seo.col.keyword, d.seo.col.volume, d.seo.col.category, t(d.seo.col.position, { brand: CLIENT.brandLabel }), ...comps.map((c) => c.label), "has_ai_overview", "client_in_ai"];
  const body = toCsv(headers, rows.map((r) => [r.keyword, r.volume, r.category, r.clientPos, ...comps.map((c) => r.positions[c.domain]), r.hasAiOverview, r.clientInAi]));
  return csvResponse(body, `seo_${market}_${result.category}${data.meta.snapshotDate ? "_" + data.meta.snapshotDate : ""}.csv`);
}
