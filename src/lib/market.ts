import "server-only";
import { cookies } from "next/headers";
import { MARKETS, type MarketCode } from "./config";

/** Market from the URL, then the cookie, then the default market. */
export async function resolveMarket(requested: string | string[] | null | undefined): Promise<MarketCode> {
  const want = typeof requested === "string" ? requested.toUpperCase() : (await cookies()).get("market")?.value;
  return (MARKETS.find((m) => m.code === want) ?? MARKETS.find((m) => m.isDefault) ?? MARKETS[0]).code;
}

export const param = (v: string | string[] | undefined, fallback: string) => (typeof v === "string" && v ? v : fallback);
