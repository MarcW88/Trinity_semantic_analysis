import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { buildMarket, readFirstSheet } from "./excel";
import type { MarketData } from "./types";

const DATA_DIR = join(/*turbopackIgnore: true*/ process.cwd(), "data");
const cache = new Map<string, { stamp: string; data: MarketData | null }>();

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
  cache.set(market, { stamp, data });
  return data;
}
