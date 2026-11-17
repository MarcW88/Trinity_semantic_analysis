import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildMarket, readFirstSheet, serpRows, type SerpRow, type SourceFile } from "./excel";
import type { MarketData } from "./types";
import type { Benchmark } from "./benchmark";

const DATA_DIR = join(/*turbopackIgnore: true*/ process.cwd(), "data");
const cache = new Map<string, { stamp: string; data: MarketData | null; files: SourceFile[] }>();

/** Loads data/<market>/*.xlsx; re-parsed only when a file changes. */
export async function getMarketData(market: string): Promise<MarketData | null> {
  const dir = join(DATA_DIR, market);
  let names: string[];
  try {
    names = (await readdir(dir)).filter((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$")).sort();
  } catch {
    return null;
  }
  const stats = await Promise.all(names.map((n) => stat(join(dir, n))));
  const stamp = names.map((n, i) => `${n}:${stats[i].size}:${stats[i].mtimeMs}`).join("|");
  const hit = cache.get(market);
  if (hit && hit.stamp === stamp) return hit.data;
  const files = await Promise.all(names.map(async (n) => readFirstSheet(new Uint8Array(await readFile(join(dir, n))), n)));
  const data = buildMarket(market, files);
  cache.set(market, { stamp, data, files });
  return data;
}

/** Rows of the `serp` worksheet(s) of data/<market>/*.xlsx, with the workbook date; null when there is none. */
export async function getTrackedSerp(market: string): Promise<{ rows: SerpRow[]; generatedAt: string } | null> {
  await getMarketData(market);
  const files = cache.get(market)?.files ?? [];
  const rows = serpRows(files);
  if (rows.length === 0) return null;
  const dates = files.filter((f) => f.serp?.length && f.modified).map((f) => f.modified!.toISOString()).sort();
  return { rows, generatedAt: dates.at(-1) ?? "" };
}

export async function hasMarketData(market: string): Promise<boolean> {
  try {
    return (await readdir(join(DATA_DIR, market))).some((n) => /\.xlsx$/i.test(n) && !n.startsWith("~$"));
  } catch {
    return false;
  }
}

const benchCache = new Map<string, { stamp: number; data: Benchmark | null }>();

/** data/<market>/benchmark.json, produced by scripts/fetch-benchmark.mjs. */
export async function getBenchmark(market: string): Promise<Benchmark | null> {
  const file = join(DATA_DIR, market, "benchmark.json");
  let stamp: number;
  try { stamp = (await stat(file)).mtimeMs; } catch { return null; }
  const hit = benchCache.get(market);
  if (hit && hit.stamp === stamp) return hit.data;
  const data = JSON.parse(await readFile(file, "utf8")) as Benchmark;
  benchCache.set(market, { stamp, data });
  return data;
}
