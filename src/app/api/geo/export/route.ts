import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guard";
import { resolveMarket } from "@/lib/market";
import { getGeoView, parseGeoFilters } from "@/lib/geo/service";
import { filterRuns, isValidRun, runCitesClient } from "@/lib/geo/compute";
import { csvResponse, toCsv } from "@/lib/csv";

/** Exports the filtered GEO runs (one row per run) with the question list filters applied. */
export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof Response) return user;
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { market } = await resolveMarket(user.projectId, sp.market);
  const filters = parseGeoFilters(sp);
  const view = await getGeoView(user.projectId, market, filters);
  const status = sp.status === "active" || sp.status === "archived" ? sp.status : "all";
  const needle = (sp.q ?? "").trim().toLowerCase();
  const keep = new Set(view.result.questions
    .filter((x) => (status === "all" || x.status === status) && (sp.brand !== "present" || x.brandPresent) && (sp.brand !== "absent" || !x.brandPresent))
    .filter((x) => !needle || x.question.toLowerCase().includes(needle) || x.questionId.toLowerCase().includes(needle))
    .map((x) => x.questionId));
  const qmap = new Map(view.questions.map((q) => [q.questionId, q]));
  const runs = filterRuns(view.runs, qmap, filters).filter((r) => keep.has(r.questionId)).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  const body = toCsv(
    ["market", "question_id", "question_version", "question", "status_question", "run_id", "observed_at_utc", "platform", "model", "web_search", "run_status", "valid", "brand_mentioned", "client_cited", "cited_urls", "invalidated_reason"],
    runs.map((r) => {
      const q = qmap.get(r.questionId);
      return [market, r.questionId, r.questionVersion, q?.versions.find((v) => v.version === r.questionVersion)?.question ?? "", q?.status ?? "", r.runId, r.observedAt, r.platform, r.model, r.webSearch, r.status,
        isValidRun(r), r.brandMentioned, isValidRun(r) ? runCitesClient(r, view.project.clientDomains) : null, r.citations.map((c) => c.citedUrl).join(" "), r.invalidReason];
    }),
  );
  return csvResponse(body, `geo_${market}.csv`);
}
