"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items, market }: { items: { href: string; label: string }[]; market: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="Main">
      {items.map((it) => {
        const active = pathname.startsWith(it.href);
        const href = it.href.startsWith("/admin") ? it.href : `${it.href}?market=${market}`;
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
