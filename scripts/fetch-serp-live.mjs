// Live Google SERP (top 20) for every tracked keyword of a market (DataForSEO SERP API), aggregated per domain into
// data/<MARKET>/benchmark.json `serpLeaders`. Traffic = volume x CTR(position). ~0.0006 $ per keyword (standard queue).
// Usage: DATAFORSEO_LOGIN=… DATAFORSEO_PASSWORD=… node scripts/fetch-serp-live.mjs BEFR
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const MARKETS = { BENL: { location: 2056, language: "nl" }, BEFR: { location: 2056, language: "fr" }, BEEN: { location: 2056, language: "en" } };
const CTR = [0.316, 0.143, 0.089, 0.067, 0.054, 0.045, 0.038, 0.033, 0.029, 0.026];
const ctr = (p) => (p <= 10 ? CTR[p - 1] : p <= 20 ? 0.01 : 0);
const market = (process.argv[2] ?? "").toUpperCase();
if (!MARKETS[market]) throw new Error(`Usage: node scripts/fetch-serp-live.mjs <${Object.keys(MARKETS).join("|")}>`);
const { DATAFORSEO_LOGIN: login, DATAFORSEO_PASSWORD: password } = process.env;
if (!login || !password) throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required");
const auth = "Basic " + Buffer.from(`${login}:${password}`).toString("base64");

const dir = join("data", market);
const volumes = new Map();
for (const name of readdirSync(dir).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$")).sort()) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(join(dir, name)));
  const ws = wb.worksheets[0];
  const cols = {};
  ws?.getRow(1).eachCell((c, i) => { cols[String(c.text ?? "").trim().toLowerCase()] = i; });
  if (cols.keyword) ws.eachRow((r, n) => {
    const k = String(r.getCell(cols.keyword).text ?? "").trim().toLowerCase();
    if (n > 1 && k && !volumes.has(k)) volumes.set(k, Number(String(cols.volume ? r.getCell(cols.volume).text : "0").replace(/\s/g, "")) || 0);
  });
}

const api = async (path, body) => {
  const res = await fetch(`https://api.dataforseo.com/v3/${path}`, body ? { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) } : { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`);
  return res.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Standard (priority 1) tasks: DataForSEO resolves google.com/goto links to the real destination URLs.
async function serpAll(keywords) {
  const ids = new Map();
  for (let i = 0; i < keywords.length; i += 100) {
    const j = await api("serp/google/organic/task_post", keywords.slice(i, i + 100).map((keyword) => ({ keyword, tag: keyword, location_code: MARKETS[market].location, language_code: MARKETS[market].language, device: "desktop", depth: 20 })));
    for (const t of j.tasks ?? []) if (t.status_code === 20100) ids.set(t.data.tag, t.id); else console.warn(`post failed: ${t.data?.keyword} ${t.status_message}`);
  }
  const results = new Map();
  for (let round = 0; ids.size > results.size && round < 60; round++) {
    await sleep(30000);
    const pending = [...ids].filter(([kw]) => !results.has(kw));
    for (let i = 0; i < pending.length; i += 20) {
      await Promise.all(pending.slice(i, i + 20).map(async ([kw, id]) => {
        const t = (await api(`serp/google/organic/task_get/regular/${id}?resolve_goto_urls=true`))?.tasks?.[0];
        if (t?.status_code === 20000) results.set(kw, (t.result?.[0]?.items ?? []).filter((it) => it.type === "organic"));
      }).map((p) => p.catch(() => {})));
    }
    process.stdout.write(`\r${results.size}/${ids.size}`);
  }
  return results;
}
const byDomain = new Map();
const list = [...volumes.keys()];
const serps = await serpAll(list);
const serp = {};
for (const [kw, items] of serps) {
  const seen = new Set();
  serp[kw] = [];
  for (const it of items) {
    const domain = String(it.domain ?? "").replace(/^www\./, "");
    const pos = it.rank_group;
    if (!domain || !pos || seen.has(domain)) continue;
    seen.add(domain);
    if (pos <= 10) serp[kw].push({ domain, position: pos, url: it.url ?? "" });
    const d = byDomain.get(domain) ?? { domain, traffic: 0, positions: [] };
    d.traffic += (volumes.get(kw) ?? 0) * ctr(pos);
    d.positions.push({ keyword: kw, position: pos });
    byDomain.set(domain, d);
  }
}
const goto = Object.values(serp).flat().filter((r) => r.domain === "google.com").length;
const items = [...byDomain.values()].map((d) => {
  const ps = d.positions.sort((a, b) => a.position - b.position);
  return {
    domain: d.domain, keywords: ps.length, top3: ps.filter((p) => p.position <= 3).length, top10: ps.filter((p) => p.position <= 10).length,
    traffic: Math.round(d.traffic), avgPosition: Math.round((ps.reduce((s, p) => s + p.position, 0) / ps.length) * 10) / 10,
    positions: ps,
  };
}).sort((a, b) => b.top10 - a.top10 || b.traffic - a.traffic).slice(0, 30);

const file = join(dir, "benchmark.json");
const out = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { market, source: "DataForSEO", ...MARKETS[market], domains: [] };
out.serpLeaders = { generatedAt: new Date().toISOString(), trackedKeywords: list.length, keywordsWithSerp: serps.size, source: "Google SERP (top 20, desktop)", items, serp };
writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log(`\n${serps.size}/${list.length} keywords, ${byDomain.size} domains, ${goto} unresolved goto; top: ${items.slice(0, 6).map((l) => `${l.domain} (${l.top10})`).join(", ")}`);
