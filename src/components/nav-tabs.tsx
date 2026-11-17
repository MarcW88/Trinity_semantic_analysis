"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function NavTabs({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const market = useSearchParams().get("market");
  return (
    <nav aria-label="Main" className="flex gap-1">
      {items.map((it) => {
        const active = pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={market ? `${it.href}?market=${market}` : it.href} aria-current={active ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-ink text-white" : "text-ink/70 hover:bg-white"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
