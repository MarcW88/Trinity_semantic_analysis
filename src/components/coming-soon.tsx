import type { Dict } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { Reveal } from "./motion";

export function ComingSoon({ title, market, d }: { title: string; market: string; d: Dict }) {
  return (
    <Reveal className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <div className="card flex flex-col items-center gap-3 py-20 text-center" role="status">
        <span className="rounded-full bg-brown/10 px-4 py-1 text-sm font-semibold text-brown">{d.common.comingSoon}</span>
        <p className="max-w-md text-sm text-ink/60">{t(d.common.comingSoonText, { market })}</p>
      </div>
    </Reveal>
  );
}
