import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IssueList } from "@/lib/issues";
import { precheckXlsx, readWorkbook } from "@/lib/xlsx/read";
import { parseSeoWorkbook } from "@/lib/seo/contract";
import { computeSeo } from "@/lib/seo/compute";
import type { MarketData, SeoSnapshot } from "@/lib/seo/types";

const FILE = "data/out/seo_initial.xlsx";

export function marketData(s: SeoSnapshot, market: string): MarketData {
  return {
    meta: s.meta.find((m) => m.market === market)!,
    categories: s.categories.filter((c) => c.market === market),
    keywords: s.keywords.filter((k) => k.market === market),
    competitors: s.competitors.filter((c) => c.market === market),
    scopes: s.scopes.filter((c) => c.market === market),
    rankings: s.rankings.filter((c) => c.market === market),
  };
}

describe.skipIf(!existsSync(FILE))("R01 reference values from converted Streamlit sources", async () => {
  const buf = new Uint8Array(readFileSync(FILE));
  const issues = new IssueList();
  expect(precheckXlsx(buf, "seo_initial.xlsx", issues)).toBe(true);
  const wb = await readWorkbook(buf, issues);
  const { snapshot } = parseSeoWorkbook(wb!, ["BENL", "BEFR", "BEEN"], issues);

  it("validates without errors", () => {
    expect(issues.errors).toEqual([]);
    expect(snapshot).not.toBeNull();
  });

  it("BENL matches", () => {
    const r = computeSeo(marketData(snapshot!, "BENL"), "all", "DeDecker");
    expect(r.kpis).toMatchObject({ keywords: 240, volume: 89700, ranked: 4, top20: 4, top10: 2, aiCount: 8, aiCited: 0 });
    expect(r.kpis.avgPosition!.toFixed(2)).toBe("98.52");
    const tot = { top3: 0, "4-10": 0, "11-20": 0, "21+": 0, unranked: 0 };
    r.distribution.forEach((d) => Object.entries(d.counts).forEach(([k, v]) => (tot[k as keyof typeof tot] += v)));
    expect(tot).toEqual({ top3: 0, "4-10": 2, "11-20": 2, "21+": 0, unranked: 236 });
    expect(r.categories.map((c) => c.label)).not.toContain("Branding");
  });

  it("BEFR matches", () => {
    const r = computeSeo(marketData(snapshot!, "BEFR"), "all", "DeDecker");
    expect(r.kpis).toMatchObject({ keywords: 305, volume: 126650, ranked: 1, top20: 0, top10: 0, aiCount: 9, aiCited: 0 });
    expect(r.kpis.avgPosition!.toFixed(2)).toBe("99.90");
    expect(r.explorer.filter((e) => e.bucket === "21+").length).toBe(1);
  });
});
