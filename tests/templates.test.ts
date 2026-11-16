import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { IssueList } from "@/lib/issues";
import { precheckXlsx, readWorkbook } from "@/lib/xlsx/read";
import { parseSeoWorkbook } from "@/lib/seo/contract";
import { parseGeoWorkbook } from "@/lib/geo/contract";
import { buildWorkbook } from "@/lib/xlsx/write";

const MARKETS = ["BENL", "BEFR", "BEEN"];
async function load(buf: Uint8Array, name = "x.xlsx") {
  const issues = new IssueList();
  const ok = precheckXlsx(buf, name, issues);
  return { issues, wb: ok ? await readWorkbook(buf, issues) : null };
}

describe("R02 templates follow the contracts", () => {
  it("SEO template validates and excludes branding", async () => {
    const { issues, wb } = await load(new Uint8Array(readFileSync("public/templates/seo_template.xlsx")));
    const { snapshot } = parseSeoWorkbook(wb!, MARKETS, issues);
    expect(issues.errors).toEqual([]);
    expect(snapshot!.meta.map((m) => m.market)).toEqual(["BENL", "BEFR"]);
  });

  it("GEO template validates", async () => {
    const { issues, wb } = await load(new Uint8Array(readFileSync("public/templates/geo_template.xlsx")));
    const { batch } = parseGeoWorkbook(wb!, MARKETS, issues);
    expect(issues.errors).toEqual([]);
    expect(batch!.market).toBe("BENL");
    expect(batch!.runs.some((r) => r.status === "error")).toBe(true);
  });
});

describe("R03 workbook safety", () => {
  it("rejects non-xlsx and wrong extension", async () => {
    const issues = new IssueList();
    expect(precheckXlsx(new TextEncoder().encode("hello"), "x.xlsx", issues)).toBe(false);
    expect(precheckXlsx(new Uint8Array(readFileSync("public/templates/seo_template.xlsx")), "x.xls", new IssueList())).toBe(false);
  });

  it("rejects formulas and merged cells", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Meta");
    ws.addRow(["schema_version", "market"]);
    ws.addRow([{ formula: "1+1", result: 2 }, "BENL"]);
    ws.mergeCells("A3:B3");
    const { issues } = await load(new Uint8Array(await wb.xlsx.writeBuffer()));
    const codes = issues.errors.map((e) => e.code);
    expect(codes).toContain("cell.formula");
    expect(codes).toContain("sheet.merged_cells");
  });

  it("reports missing sheets/headers and bad references with sheet/row/field", async () => {
    const buf = await buildWorkbook([
      { name: "Meta", headers: ["schema_version", "market", "snapshot_date", "source"], rows: [["1", "BENL", "2026-04-07", "t"]] },
      { name: "Categories", headers: ["market", "category_id", "label", "include_in_dashboard", "sort_order"], rows: [["BENL", "a", "A", true, 1]] },
      { name: "Keywords", headers: ["market", "keyword_id", "keyword", "volume", "category_id", "has_ai_overview", "client_in_ai", "client_pos"], rows: [
        ["BENL", "k1", "Zetel", 10, "a", false, false, 0],
        ["BENL", "k2", " zetel ", 10, "zzz", false, true, 3],
      ] },
      { name: "Competitors", headers: ["market", "domain", "label", "sort_order"], rows: [["BENL", "x.be", "X", 1]] },
      { name: "CompetitorScopes", headers: ["market", "scope", "domain", "sort_order"], rows: [["BENL", "default", "y.be", 1]] },
      { name: "Rankings", headers: ["market", "keyword_id", "domain", "position"], rows: [["BENL", "k9", "x.be", 2]] },
    ]);
    const { issues, wb } = await load(new Uint8Array(buf));
    parseSeoWorkbook(wb!, MARKETS, issues);
    const codes = issues.errors.map((e) => `${e.sheet}:${e.code}`);
    expect(codes).toEqual(expect.arrayContaining([
      "Keywords:field.int_positive", "Keywords:dup.keyword", "Keywords:ref.category", "Keywords:ai.cited_without_overview",
      "CompetitorScopes:ref.competitor", "CompetitorScopes:scope.default_missing", "Rankings:ref.keyword",
    ]));
    expect(issues.errors.find((e) => e.code === "dup.keyword")!.row).toBe(3);
  });
});
