/**
 * Generates fictitious SEO and GEO workbooks that follow the import contracts.
 * Usage: npx tsx scripts/make-templates.ts [outDir=public/templates]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildWorkbook } from "../src/lib/xlsx/write";
import { SEO_SCHEMA_VERSION } from "../src/lib/seo/contract";
import { GEO_SCHEMA_VERSION } from "../src/lib/geo/contract";

const out = process.argv[2] ?? "public/templates";

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

async function seo() {
  const r = rng(42);
  const markets = ["BENL", "BEFR"] as const;
  const cats: Record<string, [string, string][]> = {
    BENL: [["salons", "Salons"], ["slaapkamer", "Slaapkamer"], ["eetkamer", "Eetkamer"]],
    BEFR: [["salons", "Salons"], ["chambre", "Chambre"], ["salle-a-manger", "Salle à manger"]],
  };
  const words: Record<string, string[]> = {
    BENL: ["zetel", "hoekzetel", "relaxzetel", "bed", "boxspring", "matras", "eettafel", "stoel", "dressoir", "kast"],
    BEFR: ["canapé", "canapé d'angle", "fauteuil relax", "lit", "boxspring", "matelas", "table à manger", "chaise", "buffet", "armoire"],
  };
  const mods = ["", " kopen", " design", " leer", " promo"];
  const modsFr = ["", " acheter", " design", " cuir", " promo"];
  const comps = [["concurrent-a.be", "Concurrent A", "#4A90A4"], ["concurrent-b.be", "Concurrent B", "#C4956A"], ["concurrent-c.be", "Concurrent C", "#9C8AA5"]];
  const meta: (string | number | null)[][] = [], categories: (string | number | boolean)[][] = [], keywords: (string | number | boolean | null)[][] = [];
  const competitors: (string | number)[][] = [], scopes: (string | number)[][] = [], rankings: (string | number)[][] = [];
  for (const m of markets) {
    meta.push([SEO_SCHEMA_VERSION, m, "2026-04-07", "Fictitious example", "Données fictives", "desktop", 100, "EUR"]);
    cats[m].forEach(([id, label], i) => categories.push([m, id, label, true, i + 1]));
    categories.push([m, "branding", m === "BENL" ? "Merk en waarden" : "Marque et valeurs", false, 99]);
    comps.forEach(([d, l, c], i) => { competitors.push([m, d, l, i + 1, c]); scopes.push([m, "default", d, i + 1]); });
    scopes.push([m, cats[m][1][0], comps[0][0], 1]);
    let n = 0;
    for (const [w, base] of words[m].entries()) {
      for (const mod of (m === "BENL" ? mods : modsFr)) {
        n++;
        const id = `${m}-${String(n).padStart(4, "0")}`;
        const cat = cats[m][Math.min(2, Math.floor(w / 4))][0];
        const pos = r() < 0.35 ? 1 + Math.floor(r() * 60) : null;
        const ai = r() < 0.2;
        keywords.push([m, id, `${base}${mod}`, 10 * Math.round(50 + r() * 2000), cat, ai, ai && pos !== null && pos <= 10, pos, pos ? `https://www.dedecker.be/${m.slice(2).toLowerCase()}/${cat}` : null]);
        for (const [d] of comps) if (r() < 0.6) rankings.push([m, id, d, 1 + Math.floor(r() * 80)]);
      }
    }
    keywords.push([m, `${m}-9999`, m === "BENL" ? "dedecker meubelen" : "dedecker meubles", 500, "branding", false, false, 1, "https://www.dedecker.be/"]);
  }
  return buildWorkbook([
    { name: "Meta", headers: ["schema_version", "market", "snapshot_date", "source", "notes", "device", "serp_depth", "currency"], rows: meta },
    { name: "Categories", headers: ["market", "category_id", "label", "include_in_dashboard", "sort_order"], rows: categories },
    { name: "Keywords", headers: ["market", "keyword_id", "keyword", "volume", "category_id", "has_ai_overview", "client_in_ai", "client_pos", "client_url"], rows: keywords, widths: [8, 12, 30, 10, 16, 16, 14, 10, 40] },
    { name: "Competitors", headers: ["market", "domain", "label", "sort_order", "color_hex"], rows: competitors },
    { name: "CompetitorScopes", headers: ["market", "scope", "domain", "sort_order"], rows: scopes },
    { name: "Rankings", headers: ["market", "keyword_id", "domain", "position"], rows: rankings },
  ]);
}

async function geo() {
  const r = rng(7);
  const qs = [
    ["Q001", "Welke winkel verkoopt de beste relaxzetels in België?", "salons"],
    ["Q002", "Waar koop ik een boxspring in Vlaanderen?", "slaapkamer"],
    ["Q003", "Beste meubelwinkel voor een eettafel op maat?", "eetkamer"],
    ["Q004", "Welke merken van hoekzetels zijn duurzaam?", "salons"],
    ["Q005", "Is een leren zetel een goede investering?", "salons"],
  ];
  const questions = qs.map(([id, q, c]) => [id, 1, q, "active", c, null, null, null]);
  questions.push(["Q001", 2, "Welke winkel in België verkoopt de beste relaxzetels?", "active", "salons", null, null, null]);
  questions.push(["Q006", 1, "Waar vind ik vintage dressoirs?", "archived", "eetkamer", null, null, null]);
  const platforms: [string, string, string][] = [["chatgpt", "gpt-4o", "on"], ["perplexity", "sonar", "on"], ["gemini", "gemini-2.0-flash", "unknown"]];
  const runs: (string | number | boolean | null)[][] = [], citations: (string | number)[][] = [];
  const start = Date.UTC(2026, 2, 2, 8, 0, 0);
  for (let week = 0; week < 8; week++) {
    if (week === 5) continue;
    for (const [qid] of qs) {
      for (const [p, model, ws] of platforms) {
        const ts = new Date(start + week * 7 * 864e5 + Math.floor(r() * 3 * 864e5)).toISOString().replace(/\.\d+Z$/, "Z");
        const runId = `R-${qid}-${p}-${week}`;
        const version = qid === "Q001" && week >= 4 ? 2 : 1;
        if (r() < 0.08) { runs.push([runId, qid, version, ts, p, model, ws, "error", null, null, "timeout", null]); continue; }
        const mentioned = r() < 0.4;
        runs.push([runId, qid, version, ts, p, model, ws, "success", mentioned, `Fictitious answer for ${qid} on ${p}.`, null, null]);
        let order = 1;
        if (mentioned && r() < 0.6) citations.push([runId, `https://www.dedecker.be/nl/${qs.find((x) => x[0] === qid)![2]}`, order++]);
        citations.push([runId, `https://www.concurrent-a.be/item-${week}`, order++]);
        if (r() < 0.5) citations.push([runId, `https://www.example-blog.be/gids-${qid.toLowerCase()}`, order++]);
      }
    }
  }
  return buildWorkbook([
    { name: "Meta", headers: ["schema_version", "market", "source", "collected_from", "collected_to", "notes"], rows: [[GEO_SCHEMA_VERSION, "BENL", "Fictitious example", "2026-03-02", "2026-04-26", "Données fictives"]] },
    { name: "Questions", headers: ["question_id", "question_version", "question", "status", "category_id", "seo_keyword_id", "persona", "topic_group_id"], rows: questions, widths: [12, 16, 60, 10, 14, 14, 12, 14] },
    { name: "Runs", headers: ["run_id", "question_id", "question_version", "observed_at", "platform", "model", "web_search", "status", "brand_mentioned", "answer_text", "error_code", "replaces_run_id"], rows: runs },
    { name: "Citations", headers: ["run_id", "cited_url", "citation_order"], rows: citations, widths: [24, 60, 14] },
  ]);
}

async function main() {
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "seo_template.xlsx"), await seo());
  await writeFile(path.join(out, "geo_template.xlsx"), await geo());
  console.log(`Templates written to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
