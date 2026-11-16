"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { setMarketCookie } from "@/app/actions";

export function MarketSwitcher({ market, options, label }: { market: string; options: { code: string; label: string }[]; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label={label}
      className="select"
      value={market}
      disabled={pending}
      onChange={(e) => start(async () => {
        await setMarketCookie(e.target.value);
        const next = new URLSearchParams(params.toString());
        next.set("market", e.target.value);
        router.push(`${pathname.startsWith("/geo/q/") ? "/geo" : pathname}?${next.toString()}`);
      })}
    >
      {options.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}
