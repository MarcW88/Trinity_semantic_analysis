// Domains that rank on the market's tracked keywords (DataForSEO Labs serp_competitors), added to data/<MARKET>/benchmark.json as `serpLeaders`.
// Usage: DATAFORSEO_LOGIN=… DATAFORSEO_PASSWORD=… node scripts/fetch-serp-leaders.mjs BEFR
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const MARKETS = { BENL: { location: 2056, language: "nl" }, BEFR: { location: 2056, language: "fr" }, BEEN: { location: 2056, language: "en" } };
const market = (process.argv[2] ?? "").toUpperCase();
if (!MARKETS[market]) throw new Error(`Usage: node scripts/fetch-serp-leaders.mjs <${Object.keys(MARKETS).join("|")}>`);
const { DATAFORSEO_LOGIN: login, DATAFORSEO_PASSWORD: password } = process.env;
if (!login || !password) throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required");
const auth = "Basic " + Buffer.from(`${login}:${password}`).toString("base64");

const dir = join("data", market);
const keywords = new Set();
for (const name of readdirSync(dir).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$")).sort()) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(join(dir, name)));
  const ws = wb.worksheets[0];
  let col = 0;
  ws?.getRow(1).eachCell((c, i) => { if (String(c.text ?? "").trim().toLowerCase() === "keyword") col = i; });
  if (col) ws.eachRow((r, n) => { const k = String(r.getCell(col).text ?? "").trim().toLowerCase(); if (n > 1 && k) keywords.add(k); });
}
const list = [...keywords];
const byDomain = new Map();
for (let i = 0; i < list.length; i += 200) {
  const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/serp_competitors/live", {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify([{ keywords: list.slice(i, i + 200), ...{ location_code: MARKETS[market].location, language_code: MARKETS[market].language }, limit: 1000 }]),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`);
  const task = (await res.json())?.tasks?.[0];
  if (!task || task.status_code !== 20000) throw new Error(`DataForSEO task error: ${task?.status_message}`);
  for (const it of task.result?.[0]?.items ?? []) {
    const d = byDomain.get(it.domain) ?? { domain: it.domain, traffic: 0, positions: {} };
    d.traffic += it.etv ?? 0;
    for (const [kw, ps] of Object.entries(it.keywords_positions ?? {})) d.positions[kw] = Math.min(d.positions[kw] ?? 1e9, ...ps);
    byDomain.set(it.domain, d);
  }
}
const leaders = [...byDomain.values()].map((d) => {
  const ps = Object.entries(d.positions).map(([keyword, position]) => ({ keyword, position })).sort((a, b) => a.position - b.position);
  return {
    domain: d.domain.replace(/^www\./, ""), keywords: ps.length, top3: ps.filter((p) => p.position <= 3).length, top10: ps.filter((p) => p.position <= 10).length,
    traffic: Math.round(d.traffic), avgPosition: Math.round((ps.reduce((s, p) => s + p.position, 0) / Math.max(ps.length, 1)) * 10) / 10, positions: ps.slice(0, 50),
  };
}).sort((a, b) => b.top10 - a.top10 || b.traffic - a.traffic).slice(0, 30);

const file = join(dir, "benchmark.json");
const out = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { market, source: "DataForSEO Labs", ...MARKETS[market], domains: [] };
out.serpLeaders = { generatedAt: new Date().toISOString(), trackedKeywords: list.length, items: leaders };
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`${list.length} keywords, ${byDomain.size} domains; top: ${leaders.slice(0, 5).map((l) => `${l.domain} (${l.top10} top10)`).join(", ")}`);
