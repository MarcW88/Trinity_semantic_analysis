/**
 * Converts the four active Streamlit workbooks into the SEO workbook contract (schema_version 1).
 * Usage: npx tsx scripts/convert-legacy.ts --src <dir> [--out data/out/seo_initial.xlsx] [--benl-date YYYY-MM-DD] [--befr-date YYYY-MM-DD]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import ExcelJS from "exceljs";
import { buildWorkbook } from "../src/lib/xlsx/write";

type Raw = Record<string, unknown>;
const args = Object.fromEntries(process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const SRC = args.src ?? "data/sources";
const OUT = args.out ?? "data/out/seo_initial.xlsx";
const DATES = { BENL: args["benl-date"] ?? "2026-04-07", BEFR: args["befr-date"] ?? "2026-04-08" };
const EXCLUDED = new Set(["Branding", "Marque et valeurs"]);
const CATEGORY_FIX: Record<string, string> = { keukens: "Keukens", "Intérieur & sur-mesure": "Intérieur & Sur-mesure" };

type MarketSpec = {
  market: "BENL" | "BEFR"; main: string; extra: string; categoryCol: string; extraScope: string;
  defaults: [string, string][]; extras: [string, string][];
};
const SPECS: MarketSpec[] = [
  {
    market: "BENL", main: "Keyword_Research_DeDecker_BENL_FINAL .xlsx", extra: "Keywords_SERP_Final_badkamers_dedecker.xlsx",
    categoryCol: "category", extraScope: "Badkamers",
    defaults: [["vika.be", "Vika"], ["dsmkeukens.be", "DSM Keukens"], ["dovykeukens.be", "Dovy"], ["diapal.be", "Diapal"]],
    extras: [["groepwouters.be", "Groep Wouters"], ["debadbeke.be", "De Badbeke"], ["x2o.be", "X2O"], ["facq.be", "Facq"], ["vanmarcke.com", "Vanmarcke"]],
  },
  {
    market: "BEFR", main: "Keywords_SERP_Final_FR-Dedecker.xlsx", extra: "Keywords_SERP_Final_salle_de_bains.xlsx",
    categoryCol: "Category", extraScope: "Salle de bains",
    defaults: [["cuisinesdovy.be", "Dovy"], ["ixina.be", "Ixina"], ["vandenborrekitchen.be", "Vandenborre"], ["dsmcuisines.be", "DSM Cuisines"]],
    extras: [["sanijura.be", "Sanijura"], ["mobalpa.be", "Mobalpa"], ["x2o.be", "X2O"], ["facq.be", "Facq"], ["vanmarcke.com", "Vanmarcke"]],
  },
];
const COLORS: Record<string, string> = {
  "vika.be": "#C4956A", "dsmkeukens.be": "#4A90A4", "dovykeukens.be": "#7A9E7E", "diapal.be": "#D4A87C",
  "cuisinesdovy.be": "#7A9E7E", "ixina.be": "#4A90A4", "vandenborrekitchen.be": "#C4956A", "dsmcuisines.be": "#D4A87C",
  "groepwouters.be": "#6AAFC3", "debadbeke.be": "#A3B18A", "x2o.be": "#B07D56", "facq.be": "#82C0D2", "vanmarcke.com": "#9C8AA5",
  "sanijura.be": "#6AAFC3", "mobalpa.be": "#A3B18A",
};

async function readSheet(path: string): Promise<Raw[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(path) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { headers[col] = String(c.text ?? "").trim(); });
  const rows: Raw[] = [];
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    if (n === 1) return;
    const o: Raw = {};
    headers.forEach((h, col) => { if (h) { const v = r.getCell(col).value; o[h] = v && typeof v === "object" && "result" in v ? v.result : v; } });
    rows.push(o);
  });
  return rows;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    const o = v as { hyperlink?: string; text?: unknown; richText?: { text: string }[] };
    if (o.hyperlink) return o.hyperlink.trim();
    if (o.richText) return o.richText.map((t) => t.text).join("").trim();
    if (o.text !== undefined) return str(o.text);
  }
  return String(v).trim();
}
const legacyBool = (v: unknown) => ["true", "1", "yes", "vrai"].includes(str(v).toLowerCase());
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);
const report: string[] = [];

function toPos(v: unknown, where: string): number | null {
  const s = str(v);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) { report.push(`ignored position "${s}" (${where})`); return null; }
  if (!Number.isInteger(n)) { report.push(`rounded position ${n} (${where})`); return Math.round(n); }
  return n;
}
function toNum(v: unknown): number | null {
  const s = str(v).replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const meta: (string | number | null)[][] = [];
  const categories: (string | number | boolean | null)[][] = [];
  const keywords: (string | number | boolean | null)[][] = [];
  const competitors: (string | number | null)[][] = [];
  const scopes: (string | number)[][] = [];
  const rankings: (string | number)[][] = [];

  for (const spec of SPECS) {
    const { market } = spec;
    const main = await readSheet(join(SRC, spec.main));
    const extra = await readSheet(join(SRC, spec.extra));
    const extraByKw = new Map(extra.map((r) => [str(r.keyword), r]));
    meta.push(["1", market, DATES[market], `${spec.main} + ${spec.extra}`, "Converted from Streamlit commit d2a9490; snapshot date provisional", "desktop", 100, "EUR"]);

    const catLabels: string[] = [];
    const catIds = new Map<string, string>();
    const rows = main.filter((r) => str(r.keyword));
    for (const r of rows) {
      let label = str(r[spec.categoryCol]) || "Non catégorisé";
      label = CATEGORY_FIX[label] ?? label;
      if (!catIds.has(label)) { catIds.set(label, slug(label)); catLabels.push(label); }
    }
    const sortedLabels = [...catLabels].sort((a, b) => a.localeCompare(b));
    sortedLabels.forEach((l, i) => categories.push([market, catIds.get(l)!, l, !EXCLUDED.has(l), i + 1]));

    const allComps = [...spec.defaults, ...spec.extras];
    allComps.forEach(([d, l], i) => competitors.push([market, d, l, i + 1, COLORS[d] ?? null]));
    spec.defaults.forEach(([d], i) => scopes.push([market, "default", d, i + 1]));
    spec.extras.forEach(([d], i) => scopes.push([market, catIds.get(spec.extraScope) ?? slug(spec.extraScope), d, i + 1]));

    rows.forEach((r, i) => {
      const id = `${market}-${String(i + 1).padStart(4, "0")}`;
      const kw = str(r.keyword);
      let label = str(r[spec.categoryCol]) || "Non catégorisé";
      label = CATEGORY_FIX[label] ?? label;
      const hasAi = legacyBool(r.has_ai_overview);
      let inAi = legacyBool(r.client_in_ai);
      if (inAi && !hasAi) { report.push(`${id} client_in_ai without AI overview -> false`); inAi = false; }
      const clientUrlRaw = str(r.client_url);
      const clientUrl = isUrl(clientUrlRaw) ? clientUrlRaw : null;
      if (clientUrlRaw && !clientUrl) report.push(`${id} client_url "${clientUrlRaw}" not a URL -> ignored`);
      const sourcesRaw = str(r.client_ai_sources);
      const sources = sourcesRaw.split(/[\s,;|]+/).filter(isUrl);
      let cpc = toNum(r.cpc);
      let competition = str(r.competition) || null;
      if (cpc === null && /^(LOW|MEDIUM|HIGH)$/i.test(str(r.cpc))) {
        competition = str(r.cpc); cpc = toNum(r.client_ai_sources);
        report.push(`${id} shifted cpc/competition columns realigned`);
      }
      keywords.push([
        market, id, kw, toPos(r.volume, `${id} volume`) ?? 0, catIds.get(label)!, hasAi, inAi,
        toPos(r.client_pos, `${id} client_pos`), clientUrl, sources.join(" ") || null, null,
        str(r.priority) || null, str(r.source) || null, cpc, competition, str(r.PAA) || null, ["0", "false", ""].includes(str(r["ilwa.be_pos"]).toLowerCase()) ? null : toPos(r["ilwa.be_pos"], `${id} ilwa`),
      ]);
      for (const [d] of spec.defaults) {
        const p = toPos(r[`${d}_pos`], `${id} ${d}`);
        if (p !== null) rankings.push([market, id, d, p]);
      }
      const ex = extraByKw.get(kw);
      if (!ex) report.push(`${id} "${kw}" missing from ${spec.extra}`);
      for (const [d] of spec.extras) {
        const p = ex ? toPos(ex[`${d}_pos`], `${id} ${d}`) : null;
        if (p !== null) rankings.push([market, id, d, p]);
      }
    });
  }

  const buf = await buildWorkbook([
    { name: "Meta", headers: ["schema_version", "market", "snapshot_date", "source", "notes", "device", "serp_depth", "currency"], rows: meta },
    { name: "Categories", headers: ["market", "category_id", "label", "include_in_dashboard", "sort_order"], rows: categories },
    {
      name: "Keywords",
      headers: ["market", "keyword_id", "keyword", "volume", "category_id", "has_ai_overview", "client_in_ai", "client_pos", "client_url", "client_ai_sources", "subcategory", "priority", "source", "cpc", "competition", "paa", "legacy_ilwa_pos"],
      rows: keywords,
    },
    { name: "Competitors", headers: ["market", "domain", "label", "sort_order", "color_hex"], rows: competitors },
    { name: "CompetitorScopes", headers: ["market", "scope", "domain", "sort_order"], rows: scopes },
    { name: "Rankings", headers: ["market", "keyword_id", "domain", "position"], rows: rankings },
  ]);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, buf);
  writeFileSync(OUT.replace(/\.xlsx$/, ".report.txt"), report.join("\n") + "\n");
  console.log(`Wrote ${OUT}: ${keywords.length} keywords, ${rankings.length} rankings, ${report.length} conversion notes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
