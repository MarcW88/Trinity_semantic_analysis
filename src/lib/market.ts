import "server-only";
import { cookies } from "next/headers";
import { MARKETS, type MarketCode } from "./config";
import { hasMarketData } from "./seo/source";

/** Market from the URL, then the cookie, then the first market that has data (default market first). */
export async function resolveMarket(requested: string | string[] | null | undefined): Promise<MarketCode> {
  const want = typeof requested === "string" ? requested.toUpperCase() : (await cookies()).get("market")?.value;
  const chosen = MARKETS.find((m) => m.code === want);
  if (chosen) return chosen.code;
  const ordered = [...MARKETS].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  for (const m of ordered) if (await hasMarketData(m.code)) return m.code;
  return ordered[0].code;
}

export const param = (v: string | string[] | undefined, fallback: string) => (typeof v === "string" && v ? v : fallback);
