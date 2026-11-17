import Image from "next/image";
import { Suspense } from "react";
import { requirePage } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { resolveMarket } from "@/lib/market";
import { MARKETS } from "@/lib/config";
import { MarketSwitcher } from "@/components/market-switcher";
import { LangSwitcher } from "@/components/lang-switcher";
import { logoutAction } from "../actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requirePage();
  const { d, lang } = await getDict();
  const market = await resolveMarket(null);
  const marketLabels = d.markets as Record<string, string>;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-mist/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Image src="/trinity-logo.png" alt="Trinity" width={274} height={61} className="h-6 w-auto" style={{ width: "auto" }} priority />
          <span className="hidden text-sm font-medium text-ink/50 sm:inline">{d.common.appTitle}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Suspense>
              <MarketSwitcher market={market} label={d.common.market} options={MARKETS.map((m) => ({ code: m.code, label: marketLabels[m.code] ?? m.code }))} />
            </Suspense>
            <LangSwitcher lang={lang} label={d.common.language} />
            <form action={logoutAction}><button className="btn-ghost" type="submit">{d.common.logout}</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
