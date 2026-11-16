import "server-only";
import { cookies } from "next/headers";
import { getMarkets } from "./project";

/** Market from the URL, then the cookie, then the default market. */
export async function resolveMarket(projectId: number, requested: string | string[] | undefined) {
  const markets = await getMarkets(projectId);
  const want = typeof requested === "string" ? requested.toUpperCase() : (await cookies()).get("market")?.value;
  const market = markets.find((m) => m.code === want) ?? markets.find((m) => m.isDefault) ?? markets[0];
  return { market: market.code, markets };
}

export const param = (v: string | string[] | undefined, fallback: string) => (typeof v === "string" && v ? v : fallback);
