"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function NavLinks({ items, market }: { items: { href: string; label: string }[]; market: string }) {
  const pathname = usePathname();
  const fromUrl = useSearchParams().get("market")?.toUpperCase();
  const geoMarket = pathname.match(/^\/geo\/q\/([A-Z]{4})\//)?.[1];
  const current = (fromUrl && /^[A-Z]{4}$/.test(fromUrl) ? fromUrl : geoMarket) ?? market;
  return (
    <nav className="flex gap-1" aria-label="Main">
      {items.map((it) => {
        const active = pathname.startsWith(it.href);
        const href = it.href.startsWith("/admin") ? it.href : `${it.href}?market=${current}`;
        return (
          <Link key={it.href} href={href} aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${active ? "bg-brown text-white" : "text-ink hover:bg-cream"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
