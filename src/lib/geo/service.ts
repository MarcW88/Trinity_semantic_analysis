import "server-only";
import { getProject } from "../project";
import { computeGeo } from "./compute";
import { loadGeoMarket } from "./repo";
import type { GeoFilters, WebSearch } from "./types";

type SP = Record<string, string | string[] | undefined>;
const s = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export function parseGeoFilters(sp: SP): GeoFilters {
  const ws = s(sp.web);
  return {
    from: day(s(sp.from)), to: day(s(sp.to)), platform: s(sp.platform) || "all",
    webSearch: (["on", "off", "unknown"].includes(ws) ? ws : "all") as "all" | WebSearch,
    category: s(sp.category) || "all", granularity: s(sp.g) === "month" ? "month" : "week",
  };
}

export async function getGeoView(projectId: number, market: string, filters: GeoFilters) {
  const project = await getProject(projectId);
  const { questions, runs } = await loadGeoMarket(projectId, market);
  const result = computeGeo(questions, runs, project.clientDomains, filters);
  const categories = [...new Set(questions.map((q) => q.categoryId).filter((c): c is string => Boolean(c)))].sort();
  return { project, questions, runs, result, categories, empty: questions.length === 0 };
}
