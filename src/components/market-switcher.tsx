"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { setMarketCookie } from "@/app/actions";
import { Segmented } from "./motion";

export function MarketSwitcher({ market, options, label }: { market: string; options: { code: string; label: string }[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const fromUrl = params.get("market")?.toUpperCase();
  const current = options.some((o) => o.code === fromUrl) ? fromUrl! : market;
  return (
    <Segmented label={label} layoutId="market-pill" value={current} disabled={pending}
      options={options.map((o) => ({ value: o.code, label: o.label }))}
      onChange={(code) => start(async () => {
        await setMarketCookie(code);
        router.push(`${pathname}?${new URLSearchParams({ market: code }).toString()}`, { scroll: false });
      })} />
  );
}
