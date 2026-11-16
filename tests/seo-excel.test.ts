import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMarket, readFirstSheet, type SourceFile } from "@/lib/seo/excel";
import { computeSeo } from "@/lib/seo/compute";

async function loadFolder(market: string) {
  const dir = join("data", market);
  const names = readdirSync(dir).filter((n) => n.endsWith(".xlsx"));
  const files = await Promise.all(names.map((n) => readFirstSheet(new Uint8Array(readFileSync(join(dir, n))), n)));
  return buildMarket(market, files)!;
}

const hasData = existsSync("data/BENL") && readdirSync("data/BENL").some((n) => n.endsWith(".xlsx"));

describe.skipIf(!hasData)("reference values from the Streamlit workbooks", () => {
  it("BENL matches the Streamlit dashboard", async () => {
    const data = await loadFolder("BENL");
    const r = computeSeo(data, "all", "DeDecker");
    expect(r.kpis).toMatchObject({ keywords: 240, volume: 89700, ranked: 4, top20: 4, top10: 2, aiCount: 8, aiCited: 0 });
    expect(r.kpis.avgPosition!.toFixed(2)).toBe("98.52");
    expect(r.categories.map((c) => c.label)).not.toContain("Branding");
    const bad = computeSeo(data, "badkamers", "DeDecker");
    expect(bad.domains.filter((d) => !d.isClient).map((d) => d.label)).toEqual(["Groep Wouters", "De Badbeke", "X2O", "Facq", "Vanmarcke"]);
    const keukens = computeSeo(data, "keukens", "DeDecker");
    expect(keukens.domains.filter((d) => !d.isClient).map((d) => d.label)).toContain("DSM Keukens");
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
      { keyword: "keuken", category: "Keukens", volume: 1, client_pos: "" },
      { keyword: "keukenkast", category: "Keukenkasten", volume: 1, client_pos: "" },
    ];
    const m = buildMarket("BENL", [{ name: "main.xlsx", modified: null, rows }, { name: "serp_keukenkasten.xlsx", modified: null, rows: [{ keyword: "keukenkast", "c.be_pos": 2 }] }])!;
    expect(m.scopes.find((s) => s.domain === "c.be")?.scope).toBe("keukenkasten");
  });

  it("returns null without keywords", () => {
    expect(buildMarket("BEEN", [])).toBeNull();
  });
});
