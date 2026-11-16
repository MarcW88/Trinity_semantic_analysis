import Image from "next/image";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { requirePageUser } from "@/lib/auth/guard";
import { getDict } from "@/lib/i18n/server";
import { getMarkets } from "@/lib/project";
import { NavLinks } from "@/components/nav-links";
import { MarketSwitcher } from "@/components/market-switcher";
import { LangSwitcher } from "@/components/lang-switcher";
import { logoutAction } from "../actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requirePageUser();
  const { d, lang } = await getDict();
  const markets = await getMarkets(user.projectId);
  const cookieMarket = (await cookies()).get("market")?.value;
  const market = markets.find((m) => m.code === cookieMarket)?.code ?? markets.find((m) => m.isDefault)?.code ?? markets[0]?.code ?? "BENL";
  const nav = [
    { href: "/seo", label: d.nav.seo },
    { href: "/geo", label: d.nav.geo },
    ...(user.role === "admin" ? [{ href: "/admin/imports", label: d.nav.imports }, { href: "/admin/users", label: d.nav.users }] : []),
  ];
  const marketLabels = d.markets as Record<string, string>;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2">
          <Image src="/dedecker-logo.png" alt="DeDecker" width={120} height={34} className="h-8 w-auto" priority />
          <span className="hidden text-sm text-gray-500 sm:inline">{d.common.appTitle}</span>
          <Suspense><NavLinks items={nav} market={market} /></Suspense>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Suspense>
              <MarketSwitcher market={market} label={d.common.market} options={markets.map((m) => ({ code: m.code, label: marketLabels[m.code] ?? m.code }))} />
            </Suspense>
            <LangSwitcher lang={lang} label={d.common.language} />
            <span className="hidden text-xs text-gray-500 md:inline">{user.email}</span>
            <form action={logoutAction}><button className="btn-ghost" type="submit">{d.common.logout}</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
