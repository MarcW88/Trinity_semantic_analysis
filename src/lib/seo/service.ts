import "server-only";
import { getProject } from "../project";
import { computeSeo } from "./compute";
import { loadMarketData } from "./repo";

export async function getSeoView(projectId: number, market: string, category: string) {
  const project = await getProject(projectId);
  if (!project.activeSeoVersionId) return { project, data: null, result: null };
  const data = await loadMarketData(project.activeSeoVersionId, market);
  if (!data || data.keywords.length === 0) return { project, data: null, result: null };
  return { project, data, result: computeSeo(data, category, project.brandLabel) };
}
