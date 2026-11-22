import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { buildMarket, readFirstSheet, type SourceFile } from "@/lib/seo/excel";
import { computeSeo, filterExplorer } from "@/lib/seo/compute";
import { getMarketData } from "@/lib/seo/source";

describe("BENL competitor comparisons", () => {
  it("keeps direct competitors separate from the V2 SEO competitors", async () => {
    const direct = (await getMarketData("BENL"))!;
    const seo = (await getMarketData("BENL", "seo"))!;
    expect(direct.competitors.map((c) => c.domain)).toEqual(["hetpeloton.be", "socialsky.eu", "hannibal.be", "castaar.com", "mediamixer.be"]);
    expect(seo.competitors.map((c) => c.domain)).toEqual(["varamedia.be", "customerimpact.be", "conversal.be", "ikag.be", "limelight.be"]);
    expect(seo.keywords.map((k) => k.keyword).sort()).toEqual(direct.keywords.map((k) => k.keyword).sort());
    expect(await getMarketData("BENL")).toBe(direct);
    expect(await getMarketData("BENL", "seo")).toBe(seo);
    const result = computeSeo(seo, "all", "Trinity");
    expect(result.explorer).toHaveLength(563);
    expect(result.explorer.some((r) => Object.values(r.positions).some((p) => p !== null))).toBe(true);
    for (const category of result.categories) {
      const filtered = computeSeo(seo, category.categoryId, "Trinity");
      expect(filtered.explorer.every((r) => r.categoryId === category.categoryId)).toBe(true);
    }
    expect(filterExplorer(result.explorer, "unranked", "with_ai").every((r) => r.clientPos === null && r.hasAiOverview)).toBe(true);
  });

  it("does not expose an SEO comparison for markets without a V2 workbook", async () => {
    expect(await getMarketData("BEFR", "seo")).toBeNull();
    expect(await getMarketData("BEEN", "seo")).toBeNull();
  });
});

async function loadFolder(market: string) {
  const dir = join("data", market);
  const names = readdirSync(dir).filter((n) => n.endsWith(".xlsx"));
  const files = await Promise.all(names.map((n) => readFirstSheet(new Uint8Array(readFileSync(join(dir, n))), n)));
  return buildMarket(market, files)!;
}

// Reference values come from the original DeDecker workbooks; the Trinity workbooks now in data/ have no Streamlit reference.
const hasData = existsSync("data/BENL") && readdirSync("data/BENL").some((n) => n.endsWith(".xlsx") && !/trinity/i.test(n));

describe.skipIf(!hasData)("reference values from the Streamlit workbooks", () => {
  it("BENL matches the Streamlit dashboard", async () => {
    const data = await loadFolder("BENL");
    const r = computeSeo(data, "all", "DeDecker");
    expect(r.kpis).toMatchObject({ keywords: 240, volume: 89700, ranked: 4, top20: 4, top10: 2, aiCount: 8, aiCited: 0 });
    expect(r.kpis.avgPosition!.toFixed(2)).toBe("98.52");
    expect(r.categories.map((c) => c.label)).not.toContain("Branding");
    const bad = computeSeo(data, "badkamers", "DeDecker");
    expect(bad.domains.filter((d) => !d.isClient).map((d) => d.domain)).toEqual(["groepwouters.be", "debadbeke.be", "x2o.be", "facq.be", "vanmarcke.com"]);
    const keukens = computeSeo(data, "keukens", "DeDecker");
    expect(keukens.domains.filter((d) => !d.isClient).map((d) => d.domain)).toContain("dsmkeukens.be");
  });

  it("BEFR matches the Streamlit dashboard", async () => {
    const r = computeSeo(await loadFolder("BEFR"), "all", "DeDecker");
    expect(r.kpis).toMatchObject({ keywords: 305, volume: 126650, ranked: 1, top20: 0, top10: 0, aiCount: 9, aiCited: 0 });
    expect(r.kpis.avgPosition!.toFixed(2)).toBe("99.90");
    expect(r.categories.map((c) => c.label).filter((l) => /sur-mesure/i.test(l))).toHaveLength(1);
  });
});

describe("buildMarket", () => {
  const main: SourceFile = {
    name: "SERP_BENL.xlsx", modified: new Date("2026-04-07T10:00:00Z"),
    rows: [
      { keyword: "keuken", Category: "Keukens", volume: "1 000", client_pos: 4, "a.be_pos": 1, has_ai_overview: "TRUE", client_in_ai: "true" },
      { keyword: "badkamer", Category: "Badkamers", volume: 500, client_pos: "", "a.be_pos": 0, has_ai_overview: "false", client_in_ai: "true" },
      { keyword: "merk", Category: "Branding", volume: 10, client_pos: 1 },
    ],
  };
  const bath: SourceFile = { name: "SERP_badkamers.xlsx", modified: null, rows: [{ keyword: "badkamer", "b.be_pos": 3 }] };

  it("maps columns, scopes category files and excludes branding", () => {
    const m = buildMarket("BENL", [bath, main])!;
    expect(m.meta.snapshotDate).toBe("2026-04-07");
    expect(m.keywords.map((k) => [k.keyword, k.volume, k.clientPos, k.hasAiOverview, k.clientInAi])).toEqual([
      ["keuken", 1000, 4, true, true], ["badkamer", 500, null, false, false], ["merk", 10, 1, false, false],
    ]);
    expect(m.scopes.map((s) => [s.scope, s.domain])).toEqual([["default", "a.be"], ["badkamers", "b.be"]]);
    expect(m.rankings.map((r) => [r.keywordId, r.domain, r.position])).toEqual([["BENL-1", "a.be", 1], ["BENL-2", "b.be", 3]]);
    const r = computeSeo(m, "all", "DeDecker");
    expect(r.kpis.keywords).toBe(2);
  });

  it("assigns a category workbook to the longest matching category", () => {
    const rows = [
      { keyword: "kast", category: "Kasten", volume: 1, client_pos: "" },
      { keyword: "keukenkast", category: "Keukenkasten", volume: 1, client_pos: "" },
    ];
    const m = buildMarket("BENL", [{ name: "main.xlsx", modified: null, rows }, { name: "serp_keukenkasten.xlsx", modified: null, rows: [{ keyword: "keukenkast", "c.be_pos": 2 }] }])!;
    expect(m.scopes.find((s) => s.domain === "c.be")?.scope).toBe("keukenkasten");
  });

  it("reads categories from a label column when there is no category column", () => {
    const m = buildMarket("BEFR", [{ name: "kw.xlsx", modified: null, rows: [{ keyword: "seo", label: "SEO & GEO", volume: 10 }, { keyword: "ads", label: "Google Ads", volume: 5 }] }])!;
    expect(m.categories.map((c) => c.label)).toEqual(["Google Ads", "SEO & GEO"]);
  });

  it("returns null without keywords", () => {
    expect(buildMarket("BEEN", [])).toBeNull();
  });
});
