// Snapshot of the keywords each competitor ranks for (DataForSEO Labs ranked_keywords), saved to data/<MARKET>/benchmark.json.
// Usage: DATAFORSEO_LOGIN=… DATAFORSEO_PASSWORD=… node scripts/fetch-benchmark.mjs BEFR [--max 1000]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const MARKETS = { BENL: { location: 2056, language: "nl" }, BEFR: { location: 2056, language: "fr" }, BEEN: { location: 2056, language: "en" } };
const market = (process.argv[2] ?? "").toUpperCase();
const maxIdx = process.argv.indexOf("--max");
const MAX_LIST = maxIdx > 0 ? Number(process.argv[maxIdx + 1]) : 1000;
if (!MARKETS[market]) throw new Error(`Usage: node scripts/fetch-benchmark.mjs <${Object.keys(MARKETS).join("|")}>`);
const { DATAFORSEO_LOGIN: login, DATAFORSEO_PASSWORD: password } = process.env;
if (!login || !password) throw new Error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are required");
const auth = "Basic " + Buffer.from(`${login}:${password}`).toString("base64");

const dir = join("data", market);
const domains = [];
for (const name of readdirSync(dir).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$")).sort()) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(join(dir, name)));
  wb.worksheets[0]?.getRow(1).eachCell((c) => {
    const h = String(c.text ?? "").trim().toLowerCase();
    if (h.endsWith("_pos") && h !== "client_pos" && !domains.includes(h.slice(0, -4))) domains.push(h.slice(0, -4));
  });
}
if (domains.length === 0) throw new Error(`No <domain>_pos columns in ${dir}`);

async function ranked(target) {
  const items = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live", {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify([{ target, location_code: MARKETS[market].location, language_code: MARKETS[market].language, load_rank_absolute: true, limit: 1000, offset, filters: [["ranked_serp_element.serp_item.type", "<>", "paid"]] }]),
    });
    if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`);
    const task = (await res.json())?.tasks?.[0];
    if (!task || task.status_code !== 20000) throw new Error(`DataForSEO task error for ${target}: ${task?.status_message}`);
    const batch = task.result?.[0]?.items ?? [];
    items.push(...batch);
    if (batch.length < 1000 || offset + 1000 >= (task.result?.[0]?.total_count ?? 0)) break;
  }
  return items.map((it) => {
    const s = it.ranked_serp_element?.serp_item ?? {};
    const info = it.keyword_data?.keyword_info ?? {};
    return { keyword: it.keyword_data?.keyword ?? "", position: s.rank_group ?? s.rank_absolute ?? 0, url: s.url ?? "", volume: info.search_volume ?? 0, traffic: Math.round((s.etv ?? 0) * 10) / 10, cpc: info.cpc ?? null };
  }).filter((k) => k.keyword && k.position > 0);
}

const out = { market, generatedAt: new Date().toISOString(), source: "DataForSEO Labs ranked_keywords", ...MARKETS[market], domains: [] };
for (const domain of domains) {
  const all = await ranked(domain);
  all.sort((a, b) => b.traffic - a.traffic || b.volume - a.volume || a.position - b.position);
  const band = (lo, hi) => all.filter((k) => k.position >= lo && k.position <= hi);
  const sum = (ks) => Math.round(ks.reduce((s, k) => s + k.traffic, 0));
  out.domains.push({
    domain, total: all.length, top3: band(1, 3).length, top10: band(1, 10).length, top20: band(1, 20).length,
    traffic: sum(all), trafficByRange: { top3: sum(band(1, 3)), "4-10": sum(band(4, 10)), "11-20": sum(band(11, 20)), "21+": sum(band(21, 1e9)) },
    keywords: all.slice(0, MAX_LIST),
  });
  console.log(`${domain}: ${all.length} keywords, traffic ${sum(all)}`);
}
writeFileSync(join(dir, "benchmark.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${join(dir, "benchmark.json")}`);
